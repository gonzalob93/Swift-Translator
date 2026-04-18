# pacs.008 → MT103 Translator

A client-side web application that translates **ISO 20022 pacs.008.001.08** XML messages into **SWIFT MT103** format, following the SWIFT MX-to-MT translation guidelines.

![SWIFT ISO 20022](https://img.shields.io/badge/ISO%2020022-pacs.008.001.08-gold)
![SWIFT MT](https://img.shields.io/badge/SWIFT-MT103-blue)
![No backend required](https://img.shields.io/badge/Backend-None%20required-green)

---

## Features

- **Drag & drop** XML file upload or paste directly
- **Full MT103 field mapping** from pacs.008 (fields 20, 23B, 32A, 50K, 52A, 57A, 59, 70, 71A, 72)
- **Three output views**: Raw MT103, Field breakdown, Metadata
- **Copy to clipboard** and **Download as .txt**
- **No server required** — all processing runs in the browser
- Includes a **sample pacs.008** with real bank data (JPMorgan Chase → Deutsche Bank)

---

## Field Mapping Reference

| pacs.008.001.08 Element | MT103 Field | Description |
|---|---|---|
| `GrpHdr/MsgId` / `PmtId/InstrId` | `:20:` | Sender's Reference |
| *(fixed)* | `:23B:` | Bank Operation Code = `CRED` |
| `IntrBkSttlmDt` + `IntrBkSttlmAmt` | `:32A:` | Value Date / Currency / Amount |
| `Dbtr/Nm` + `DbtrAcct/Id` + `Dbtr/PstlAdr` | `:50K:` | Ordering Customer |
| `DbtrAgt/FinInstnId/BICFI` | `:52A:` | Ordering Institution |
| `CdtrAgt/FinInstnId/BICFI` | `:57A:` | Account With Institution |
| `Cdtr/Nm` + `CdtrAcct/Id` + `Cdtr/PstlAdr` | `:59:` | Beneficiary Customer |
| `RmtInf/Ustrd` | `:70:` | Remittance Information |
| `ChrgBr` | `:71A:` | Details of Charges (SHA/OUR/BEN) |
| `PmtId/UETR` + `PmtId/EndToEndId` | `:72:` | Sender to Receiver Information |

### Charge Bearer Mapping

| pacs.008 ChrgBr | MT103 Field 71A |
|---|---|
| `DEBT` / `OUR` | `OUR` |
| `CRED` / `BEN` | `BEN` |
| `SHAR` / `SHA` | `SHA` |

---

## Project Structure

```
pacs008-to-mt103/
├── index.html              # Main web application
├── src/
│   └── translator.js       # Core translation logic (ES module)
├── sample/
│   └── pacs008_sample.xml  # Test message: JPMorgan → Deutsche Bank
├── .gitignore
└── README.md
```

---

## Running Locally

Since the app uses ES modules (`import`), it must be served over HTTP (not opened as `file://`).

### Option 1 — Python (no install needed)

```bash
cd pacs008-to-mt103
python3 -m http.server 8080
# Open: http://localhost:8080
```

### Option 2 — Node.js (npx)

```bash
cd pacs008-to-mt103
npx serve .
# Open the URL shown in terminal
```

### Option 3 — VS Code Live Server

Install the **Live Server** extension, right-click `index.html` → **Open with Live Server**.

---

## Sample Message Details

The included sample (`pacs008_sample.xml`) represents a real-world USD 50,000 wire transfer:

| Role | Entity | BIC |
|---|---|---|
| Ordering Bank | JPMorgan Chase Bank, N.A. | `CHASUS33` |
| Ordering Customer | ACME Corporation, New York | — |
| Receiving Bank | Deutsche Bank AG, Frankfurt | `DEUTDEDB` |
| Beneficiary | Berlin Tech GmbH | — |
| IBAN | DE89370400440532013000 | — |
| Purpose | Supplier payment (invoice INV-2024-00892) | — |

---

## Notes & Limitations

- **One-to-one mapping only**: this translator handles single-transaction pacs.008 messages (`NbOfTxs = 1`). Multi-transaction batch files are not supported.
- **Namespace handling**: supports both namespaced (`urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08`) and non-namespaced XML.
- **Field length truncation** is applied per MT103 standards (e.g. Field 20 max 16 chars, Field 70 max 4×35 chars).
- **IBAN** takes precedence over Othr/Id for account fields.
- This tool is intended for **testing and development** purposes. Production environments should use certified SWIFT translation engines.

---

## SWIFT Migration Context

SWIFT mandated ISO 20022 co-existence (MT + MX) from November 2022, with full MT deprecation targeted for November 2025. This tool helps teams:
- Understand the structural differences between MX and MT
- Validate translation logic during migration projects
- Test message generation end-to-end without a live SWIFT connection

---

## License

MIT — free to use, modify, and distribute.
