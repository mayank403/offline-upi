# Offline UPI Payment Suite (*99# NUUP & UPI 123PAY Simulator)

A state-of-the-art interactive simulator, reference implementation, and telecom protocol inspector for conducting **UPI payments without an internet connection** (zero mobile data, 2G GSM cellular signalling).

---

## 🌟 How Offline UPI Works in the Real World

In India, **NPCI (National Payments Corporation of India)** and the **Reserve Bank of India (RBI)** have standardized two major production methods to conduct UPI transactions without internet connectivity:

### 1. `*99#` USSD (NUUP - National Unified USSD Platform)
- **Cellular Channel**: Operates over the **SDCCH (Standalone Dedicated Control Channel)** of 2G/3G/4G/5G GSM networks.
- **Data Usage**: Exactly **0 KB** of mobile data. It does not use IP packets, Wi-Fi, or cellular data.
- **Telecom Signalling**: Transmitted as SS7 / MAP (`MAP_PROCESS_UNSTRUCTURED_SS_REQ`) messages between the handset, Mobile Switching Center (MSC/VLR), Carrier USSD Gateway, and NPCI's NUUP switch.
- **Security**: 
  - Dual-factor authenticated: Physical SIM card (IMSI binding) + NPCI 4 or 6-digit UPI PIN.
  - Zero handset trace: When the USSD dialog closes, no session data or PIN is cached on the device.
- **RBI Limits**: Up to ₹5,000 per transaction over USSD.

### 2. UPI 123PAY (Interactive Voice Response - IVR)
- **Cellular Channel**: Regular cellular voice call to designated NPCI IVR numbers (e.g., `080 4516 3666` or `6366 200 200`).
- **Flow**: Bilingual AI voice bot prompts the user to select payee, enter amount, and input UPI PIN on the telephone keypad (DTMF audio).

---

## 🚀 Features of this Simulator

- 📱 **Interactive Smartphone Frame**:
  - Authentic dialpad with **Web Audio API DTMF dual-tone frequency generator**.
  - 1-tap shortcut chips: `*99#` (Main Menu), `*99*1*1#` (Send to Mobile), `*99*3#` (Check Balance), `123PAY` (Voice IVR).
- 💬 **Authentic Carrier USSD Dialog Engine**:
  - Full multi-turn dialog tree matching the real NPCI `*99#` service:
    1. Send Money (Mobile, UPI ID, Beneficiary, IFSC)
    2. Request Money
    3. Check Balance
    4. My Profile
    5. Pending Requests
    6. Change UPI PIN
    7. Mini-statement
  - Native loading spinner ("USSD code running...") with Cancel and Send triggers.
- ⚡ **Smart Offline Pay App ("Samvaad Pay")**:
  - Linked Bank Account switcher (State Bank of India, HDFC, ICICI, PNB).
  - Offline Beneficiaries list with 1-tap USSD execution.
  - Offline custom contact storage in `localStorage`.
- 📷 **Offline UPI QR Decoder**:
  - Decodes merchant QR codes (`upi://pay?pa=...&am=...`) offline and synthesizes the exact `*99#` USSD string.
- 🎙️ **UPI 123PAY Voice Simulator**:
  - Simulated voice call with animated frequency waves and speech synthesis (Web Speech API) in English and Hindi.
- 📡 **Real-time GSM & NPCI Protocol Inspector**:
  - Visual packet pipeline highlighting: Handset ➔ BTS ➔ MSC/VLR ➔ USSD Gateway ➔ NPCI NUUP ➔ Bank CBS.
  - Live timestamped event stream of SS7/MAP messages.
- 📖 **Local Offline Ledger & Passbook**:
  - Maintains cryptographically tracked transaction receipts with simulated Carrier SMS confirmations.

---

## 🛠️ How to Run Locally

You can run this application directly in any browser:

### Option A: Using Python (Built-in)
```bash
python -m http.server 3000
```
Then open: [http://localhost:3000](http://localhost:3000)

### Option B: Using Node.js
```bash
npx serve .
```

---

## 📑 Official NPCI Shortcodes Cheat Sheet

| MMI Code | Action |
| :--- | :--- |
| `*99#` | Open NUUP Main Menu |
| `*99*1*1#` | Send Money via 10-digit Mobile Number |
| `*99*1*2#` | Send Money via UPI ID (VPA) |
| `*99*1*3#` | Send Money to Saved Beneficiary |
| `*99*1*4#` | Send Money via IFSC & Account Number |
| `*99*3#` | Direct Account Balance Enquiry |
| `*99*6#` | Change / Reset UPI PIN |
| `*99*7#` | View Last 3 Transactions (Mini-Statement) |
| `080 4516 3666` | UPI 123PAY Voice IVR Hotline |
