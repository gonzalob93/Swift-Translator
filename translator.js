/**
 * pacs.008.001.08 → MT103 Translator
 * Core mapping logic following SWIFT guidelines for MX-to-MT translation
 */

export function translatePacs008ToMT103(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");

  const parseError = xmlDoc.querySelector("parsererror");
  if (parseError) {
    throw new Error("XML inválido: " + parseError.textContent);
  }

  // Namespace resolver — handles both namespaced and non-namespaced documents
  const ns = "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08";

  function getEl(parent, ...tags) {
    for (const tag of tags) {
      // Try with namespace
      let el = parent.getElementsByTagNameNS(ns, tag)[0];
      if (!el) el = parent.getElementsByTagName(tag)[0];
      if (el) parent = el;
      else return null;
    }
    return parent;
  }

  function getText(...tags) {
    const el = getEl(xmlDoc, ...tags);
    return el ? el.textContent.trim() : "";
  }

  // ── Extract raw fields ────────────────────────────────────────────────────
  const msgId      = getText("MsgId");
  const creDtTm    = getText("CreDtTm");
  const intrBkDt   = getText("IntrBkSttlmDt") || creDtTm.split("T")[0];
  const chrgBr     = getText("ChrgBr");
  const uetr       = getText("UETR");
  const endToEndId = getText("EndToEndId");
  const txId       = getText("TxId");
  const instrId    = getText("InstrId");
  const purposeCd  = getText("Purp", "Cd");

  // Amounts
  const amtEl = xmlDoc.getElementsByTagName("IntrBkSttlmAmt")[0];
  const amount = amtEl ? amtEl.textContent.trim() : "";
  const currency = amtEl ? amtEl.getAttribute("Ccy") : "";

  // Debtor (Ordering Customer - Field 50)
  const dbtrNm   = getText("Dbtr", "Nm");
  const dbtrAcctOthr = getText("DbtrAcct", "Id", "Othr", "Id");
  const dbtrAcctIban = getText("DbtrAcct", "Id", "IBAN");
  const dbtrAcct = dbtrAcctIban || dbtrAcctOthr;
  const dbtrAdrLines = [];
  const dbtrAdrEls = xmlDoc.getElementsByTagNameNS(ns, "Dbtr")[0] ||
                     xmlDoc.getElementsByTagName("Dbtr")[0];
  if (dbtrAdrEls) {
    const lines = dbtrAdrEls.getElementsByTagName("AdrLine");
    for (const l of lines) dbtrAdrLines.push(l.textContent.trim());
    if (!dbtrAdrLines.length) {
      const ctry = dbtrAdrEls.getElementsByTagName("Ctry")[0];
      if (ctry) dbtrAdrLines.push(ctry.textContent.trim());
    }
  }

  // Debtor Agent (Field 52A)
  const dbtrAgtBic = getText("DbtrAgt", "FinInstnId", "BICFI");
  const dbtrAgtNm  = getText("DbtrAgt", "FinInstnId", "Nm");

  // Creditor Agent (Field 57A)
  const cdtrAgtBic = getText("CdtrAgt", "FinInstnId", "BICFI");
  const cdtrAgtNm  = getText("CdtrAgt", "FinInstnId", "Nm");

  // Creditor (Beneficiary - Field 59)
  const cdtrNm   = getText("Cdtr", "Nm");
  const cdtrAcctIban = getText("CdtrAcct", "Id", "IBAN");
  const cdtrAcctOthr = getText("CdtrAcct", "Id", "Othr", "Id");
  const cdtrAcct = cdtrAcctIban || cdtrAcctOthr;
  const cdtrAdrLines = [];
  const cdtrEl = xmlDoc.getElementsByTagNameNS(ns, "Cdtr")[0] ||
                 xmlDoc.getElementsByTagName("Cdtr")[0];
  if (cdtrEl) {
    const lines = cdtrEl.getElementsByTagName("AdrLine");
    for (const l of lines) cdtrAdrLines.push(l.textContent.trim());
  }

  // Remittance Info (Field 70)
  const rmtUnstrd = getText("RmtInf", "Ustrd");
  const rmtStrd   = getText("RmtInf", "Strd", "CdtrRefInf", "Ref");
  const remittance = rmtUnstrd || rmtStrd;

  // ── Format helpers ────────────────────────────────────────────────────────

  // Field 32A: YYMMDD + Currency + Amount (no decimal point if .00, else comma)
  function formatDate32A(isoDate) {
    const d = (isoDate || "").replace(/-/g, "");
    if (d.length === 8) return d.slice(2); // YYMMDD
    return isoDate;
  }

  function formatAmount32A(amt) {
    // MT uses comma as decimal separator, no thousand separators
    const n = parseFloat(amt);
    if (isNaN(n)) return amt;
    // Always show 2 decimals, comma separator
    return n.toFixed(2).replace(".", ",");
  }

  function chargeBearerMap(code) {
    const map = { SHA: "SHA", OUR: "OUR", BEN: "BEN", DEBT: "OUR", CRED: "BEN", SHAR: "SHA" };
    return map[code] || code || "SHA";
  }

  function truncate(str, maxLen) {
    return (str || "").slice(0, maxLen);
  }

  function wrap35(str) {
    // Split into lines of max 35 chars (MT standard)
    const words = (str || "").trim();
    const lines = [];
    for (let i = 0; i < words.length; i += 35) {
      lines.push(words.slice(i, i + 35));
    }
    return lines.join("\n");
  }

  // ── Build MT103 fields ────────────────────────────────────────────────────

  // F20 - Sender's Reference (max 16 chars, no slashes at start/end)
  const f20 = truncate(instrId || txId || msgId, 16).replace(/^\/|\/$/g, "");

  // F23B - Bank Operation Code
  const f23B = "CRED";

  // F32A - Value Date / Currency / Interbank Settled Amount
  const f32A = formatDate32A(intrBkDt) + currency + formatAmount32A(amount);

  // F50K - Ordering Customer (account + name + address)
  let f50K = "";
  if (dbtrAcct) f50K += "/" + dbtrAcct + "\n";
  f50K += dbtrNm;
  if (dbtrAdrLines.length) f50K += "\n" + dbtrAdrLines.slice(0, 3).join("\n");

  // F52A - Ordering Institution BIC
  const f52A = dbtrAgtBic ? dbtrAgtBic : "";

  // F57A - Account with Institution (Creditor Agent)
  const f57A = cdtrAgtBic ? cdtrAgtBic : "";

  // F59 - Beneficiary Customer
  let f59 = "";
  if (cdtrAcct) f59 += "/" + cdtrAcct + "\n";
  f59 += cdtrNm;
  if (cdtrAdrLines.length) f59 += "\n" + cdtrAdrLines.slice(0, 3).join("\n");

  // F70 - Remittance Information (max 4 lines of 35 chars)
  const f70Lines = [];
  if (remittance) {
    for (let i = 0; i < remittance.length && f70Lines.length < 4; i += 35) {
      f70Lines.push(remittance.slice(i, i + 35));
    }
  }
  const f70 = f70Lines.join("\n");

  // F71A - Details of Charges
  const f71A = chargeBearerMap(chrgBr);

  // F72 - Sender to Receiver Info (optional — UETR, EndToEnd)
  const f72Lines = [];
  if (uetr) f72Lines.push("/UETR/" + uetr.slice(0, 28));
  if (endToEndId && endToEndId !== "NOTPROVIDED") {
    f72Lines.push("/UETR2/" + truncate(endToEndId, 27));
  }
  const f72 = f72Lines.join("\n");

  // ── Assemble blocks ───────────────────────────────────────────────────────

  // Sender / Receiver BICs for block 1 & 2
  const senderBic   = (dbtrAgtBic || "AAAAUSXX").padEnd(12, "X").slice(0, 12);
  const receiverBic = (cdtrAgtBic || "BBBBDEXX").padEnd(12, "X").slice(0, 12);

  // Block 1: Basic Header
  const block1 = `{1:F01${senderBic}0000000000}`;

  // Block 2: Application Header (Output)
  const block2 = `{2:I103${receiverBic}N}`;

  // Block 3: User Header
  const block3Parts = ["{3:"];
  if (uetr) block3Parts.push(`{121:${uetr}}`);
  block3Parts.push("}");
  const block3 = block3Parts.join("");

  // Block 4: Text Block
  const lines4 = [];
  lines4.push(`{4:`);
  lines4.push(`:20:${f20}`);
  lines4.push(`:23B:${f23B}`);
  lines4.push(`:32A:${f32A}`);
  if (f50K) lines4.push(`:50K:${f50K}`);
  if (f52A) lines4.push(`:52A:${f52A}`);
  if (f57A) lines4.push(`:57A:${f57A}`);
  if (f59)  lines4.push(`:59:${f59}`);
  if (f70)  lines4.push(`:70:${f70}`);
  lines4.push(`:71A:${f71A}`);
  if (f72)  lines4.push(`:72:${f72}`);
  lines4.push(`-}`);

  const block4 = lines4.join("\n");

  const mt103 = [block1, block2, block3, block4].join("\n");

  // ── Return structured result ──────────────────────────────────────────────
  return {
    mt103,
    fields: {
      f20:  { label: "20 – Sender's Reference",            value: f20 },
      f23B: { label: "23B – Bank Operation Code",          value: f23B },
      f32A: { label: "32A – Value Date / CCY / Amount",    value: f32A },
      f50K: { label: "50K – Ordering Customer",            value: f50K },
      f52A: { label: "52A – Ordering Institution",         value: f52A },
      f57A: { label: "57A – Account With Institution",     value: f57A },
      f59:  { label: "59 – Beneficiary Customer",          value: f59 },
      f70:  { label: "70 – Remittance Information",        value: f70 },
      f71A: { label: "71A – Details of Charges",           value: f71A },
      f72:  { label: "72 – Sender to Receiver Info",       value: f72 },
    },
    meta: {
      msgId, uetr, txId, endToEndId, currency,
      amount, intrBkDt, chrgBr,
      dbtrAgtBic, dbtrAgtNm, cdtrAgtBic, cdtrAgtNm,
    },
  };
}
