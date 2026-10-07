// NPCI *99# (NUUP) USSD State Machine & Local Offline Ledger Engine

export const DEFAULT_BANKS = [
  { id: 'sbi', name: 'State Bank of India', code: 'SBIN', ifscPrefix: 'SBIN0001234', accNo: 'XXXXXX4829', pin: '1234', balance: 5420.50 },
  { id: 'hdfc', name: 'HDFC Bank', code: 'HDFC', ifscPrefix: 'HDFC0000456', accNo: 'XXXXXX8912', pin: '5678', balance: 12850.00 },
  { id: 'icici', name: 'ICICI Bank', code: 'ICIC', ifscPrefix: 'ICIC0007890', accNo: 'XXXXXX3341', pin: '9999', balance: 3100.75 },
  { id: 'pnb', name: 'Punjab National Bank', code: 'PUNB', ifscPrefix: 'PUNB0005521', accNo: 'XXXXXX1098', pin: '4321', balance: 1850.00 }
];

export const DEFAULT_CONTACTS = [
  { name: 'Ramesh (Grocery Store)', phone: '9876543210', upiId: 'ramesh.kirana@okhdfcbank', avatar: '🛒' },
  { name: 'Pooja Sharma (Roommate)', phone: '9123456789', upiId: 'pooja.sharma@paytm', avatar: '👩' },
  { name: 'Sharma Chai Stall', phone: '9988776655', upiId: 'sharmachai@ybl', avatar: '☕' },
  { name: 'Amit Verma (Auto)', phone: '9711223344', upiId: 'amit.auto@icici', avatar: '🛺' }
];

export class USSEngine {
  constructor(eventCallback) {
    this.onProtocolEvent = eventCallback || (() => {});
    this.storageKey = 'offline_upi_state_v1';
    this.loadState();
    this.resetSession();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.banks = parsed.banks || DEFAULT_BANKS;
        this.selectedBankId = parsed.selectedBankId || 'sbi';
        this.contacts = parsed.contacts || DEFAULT_CONTACTS;
        this.transactions = parsed.transactions || [];
        this.mobileNumber = parsed.mobileNumber || '9876501234';
        return;
      }
    } catch (e) {
      console.warn('LocalStorage load error', e);
    }

    this.banks = JSON.parse(JSON.stringify(DEFAULT_BANKS));
    this.selectedBankId = 'sbi';
    this.contacts = JSON.parse(JSON.stringify(DEFAULT_CONTACTS));
    this.transactions = [
      {
        id: 'UPI99/084291/SBIN',
        type: 'DEBIT',
        amount: 50.00,
        to: 'Sharma Chai Stall',
        payeeRef: 'sharmachai@ybl',
        method: '*99# USSD',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        remark: 'Tea & Snacks',
        status: 'SUCCESS',
        closingBalance: 5420.50
      }
    ];
    this.mobileNumber = '9876501234';
    this.saveState();
  }

  saveState() {
    try {
      const payload = {
        banks: this.banks,
        selectedBankId: this.selectedBankId,
        contacts: this.contacts,
        transactions: this.transactions,
        mobileNumber: this.mobileNumber
      };
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
  }

  getActiveBank() {
    return this.banks.find(b => b.id === this.selectedBankId) || this.banks[0];
  }

  resetSession() {
    this.activeSession = {
      active: false,
      step: 'IDLE',
      tempData: {},
      mmiQuery: ''
    };
  }

  // Broadcast step to protocol visualizer
  emitStep(stage, node, description, status = 'ACTIVE') {
    this.onProtocolEvent({
      stage,
      node,
      description,
      status,
      timestamp: new Date().toLocaleTimeString()
    });
  }

  // Entry point when user dials a code (e.g. *99#, *99*1*1#, *99*3#)
  dial(code) {
    const cleanCode = code.trim();
    this.resetSession();
    this.activeSession.active = true;
    this.activeSession.mmiQuery = cleanCode;

    this.emitStep('RADIO_CHANNEL', 'Mobile Station (Handset)', `Dialing MMI Code: ${cleanCode} via SDCCH signalling channel (Offline GSM)`);
    this.emitStep('MSC_VLR', 'Telecom Switch (MSC/VLR)', 'Forwarding MAP_PROCESS_UNSTRUCTURED_SS_REQ to USSD Gateway');
    this.emitStep('USSD_GW', 'Carrier USSD Gateway', 'Translating GSM MAP message to NPCI NUUP Leased Line format');
    this.emitStep('NPCI_NUUP', 'NPCI NUUP Gateway', `Validating SIM IMSI + Mobile (+91 ${this.mobileNumber})`);

    // Handle Direct MMI Shortcuts:
    // *99# -> Main Menu
    // *99*1# -> Send Money Menu
    // *99*1*1# -> Send Money to Mobile
    // *99*1*2# -> Send Money to UPI ID
    // *99*1*3# -> Send Money to Saved Beneficiary
    // *99*1*4# -> Send Money to IFSC & Account
    // *99*3# -> Check Balance directly
    // *99*4# -> My Profile
    // *99*7# -> Mini Statement / Last Transactions
    // Fast single string: *99*1*1*<number>*<amount># or *99*1*2*<upi_id>*<amount>#

    if (cleanCode === '*99#') {
      return this.renderMainMenu();
    } else if (cleanCode === '*99*1#' || cleanCode === '*99*1') {
      return this.renderSendMoneyMenu();
    } else if (cleanCode === '*99*1*1#' || cleanCode === '*99*1*1') {
      this.activeSession.step = 'SEND_MOBILE_INPUT';
      return {
        prompt: 'Enter 10-digit Mobile Number of the payee:',
        isInput: true,
        inputType: 'tel',
        placeholder: 'e.g. 9876543210'
      };
    } else if (cleanCode === '*99*1*2#' || cleanCode === '*99*1*2') {
      this.activeSession.step = 'SEND_UPI_INPUT';
      return {
        prompt: 'Enter Payee Virtual Payment Address (UPI ID):',
        isInput: true,
        inputType: 'text',
        placeholder: 'e.g. merchant@okhdfc'
      };
    } else if (cleanCode === '*99*3#' || cleanCode === '*99*3') {
      this.activeSession.step = 'CHECK_BAL_PIN';
      return {
        prompt: `Enter 4 or 6 digit UPI PIN to check balance for ${this.getActiveBank().name} (${this.getActiveBank().accNo}):`,
        isInput: true,
        inputType: 'password',
        placeholder: 'Enter UPI PIN'
      };
    } else if (cleanCode === '*99*7#' || cleanCode === '*99*7') {
      return this.renderTransactions();
    } else if (cleanCode.startsWith('*99*1*1*') && cleanCode.endsWith('#')) {
      // Direct quick send by mobile: *99*1*1*<phone>*<amount>#
      const parts = cleanCode.slice(8, -1).split('*');
      if (parts.length >= 2) {
        this.activeSession.tempData.payee = parts[0];
        this.activeSession.tempData.amount = parseFloat(parts[1]);
        this.activeSession.tempData.type = 'Mobile';
        this.activeSession.step = 'SEND_PIN';
        return {
          prompt: `Transfer ₹${this.activeSession.tempData.amount.toFixed(2)} to Mobile ${parts[0]}?\nEnter UPI PIN to approve:`,
          isInput: true,
          inputType: 'password',
          placeholder: 'Enter UPI PIN'
        };
      }
    }

    // Default unrecognized code
    this.emitStep('ERROR', 'Handset', 'MMI code completed or invalid', 'ERROR');
    this.activeSession.active = false;
    return {
      prompt: `Connection problem or invalid MMI code: ${cleanCode}`,
      isInput: false,
      isFinal: true
    };
  }

  renderMainMenu() {
    const bank = this.getActiveBank();
    this.activeSession.step = 'MAIN_MENU';
    return {
      title: 'Welcome to *99# (NUUP)',
      prompt: `Welcome to *99#\n[Bank: ${bank.name}]\n1. Send Money\n2. Request Money\n3. Check Balance\n4. My Profile\n5. Pending Requests\n6. UPI PIN\n7. Transactions`,
      isInput: true,
      inputType: 'number',
      placeholder: 'Enter option (1-7)'
    };
  }

  renderSendMoneyMenu() {
    this.activeSession.step = 'SEND_MONEY_MENU';
    return {
      prompt: `Select Send Money option:\n1. Mobile No\n2. UPI ID\n3. Saved Beneficiary\n4. IFSC & Account No\n0. Back`,
      isInput: true,
      inputType: 'number',
      placeholder: 'Enter option (1-4)'
    };
  }

  // Handle sequential responses in an active USSD session
  submitInput(input) {
    const val = (input || '').trim();
    if (!this.activeSession.active) {
      return { prompt: 'Session expired or closed.', isFinal: true };
    }

    const step = this.activeSession.step;

    // 1. MAIN MENU
    if (step === 'MAIN_MENU') {
      if (val === '1') {
        return this.renderSendMoneyMenu();
      } else if (val === '2') {
        this.activeSession.step = 'REQ_MONEY_INPUT';
        return {
          prompt: 'Enter Mobile Number or UPI ID to request money from:',
          isInput: true,
          inputType: 'text'
        };
      } else if (val === '3') {
        this.activeSession.step = 'CHECK_BAL_PIN';
        const bank = this.getActiveBank();
        return {
          prompt: `Enter UPI PIN for account ${bank.accNo} (${bank.name}):`,
          isInput: true,
          inputType: 'password'
        };
      } else if (val === '4') {
        const bank = this.getActiveBank();
        this.activeSession.active = false;
        return {
          prompt: `My Profile:\nMobile: +91 ${this.mobileNumber}\nLinked Bank: ${bank.name}\nA/C: ${bank.accNo}\nIFSC: ${bank.ifscPrefix}\nUPI ID: ${this.mobileNumber}@upi`,
          isInput: false,
          isFinal: true
        };
      } else if (val === '5') {
        this.activeSession.active = false;
        return {
          prompt: `No pending UPI collect requests at this time.`,
          isInput: false,
          isFinal: true
        };
      } else if (val === '6') {
        this.activeSession.step = 'CHANGE_PIN_OLD';
        return {
          prompt: `UPI PIN Management:\nEnter your existing UPI PIN:`,
          isInput: true,
          inputType: 'password'
        };
      } else if (val === '7') {
        return this.renderTransactions();
      } else {
        return {
          prompt: 'Invalid option. Please enter 1 to 7:\n1. Send Money\n2. Request Money\n3. Check Balance\n4. My Profile\n5. Pending\n6. UPI PIN\n7. Transactions',
          isInput: true,
          inputType: 'number'
        };
      }
    }

    // 2. SEND MONEY MENU
    if (step === 'SEND_MONEY_MENU') {
      if (val === '1') {
        this.activeSession.step = 'SEND_MOBILE_INPUT';
        return {
          prompt: 'Enter 10-digit Mobile Number of Beneficiary:',
          isInput: true,
          inputType: 'tel'
        };
      } else if (val === '2') {
        this.activeSession.step = 'SEND_UPI_INPUT';
        return {
          prompt: 'Enter Virtual Payment Address (UPI ID):\ne.g. user@okaxis, shop@ybl',
          isInput: true,
          inputType: 'text'
        };
      } else if (val === '3') {
        if (!this.contacts.length) {
          this.activeSession.step = 'SEND_MOBILE_INPUT';
          return { prompt: 'No saved contacts. Enter 10-digit Mobile No:', isInput: true };
        }
        let listText = 'Select Beneficiary:\n';
        this.contacts.forEach((c, idx) => {
          listText += `${idx + 1}. ${c.name} (${c.phone})\n`;
        });
        this.activeSession.step = 'SEND_SAVED_SELECT';
        return {
          prompt: listText,
          isInput: true,
          inputType: 'number'
        };
      } else if (val === '4') {
        this.activeSession.step = 'SEND_IFSC_INPUT';
        return {
          prompt: 'Enter 11-digit Bank IFSC code:',
          isInput: true,
          inputType: 'text'
        };
      } else if (val === '0') {
        return this.renderMainMenu();
      } else {
        return {
          prompt: 'Invalid choice. Enter 1 (Mobile), 2 (UPI ID), 3 (Saved), 4 (IFSC) or 0 (Back):',
          isInput: true,
          inputType: 'number'
        };
      }
    }

    // 3. SAVED BENEFICIARY SELECTION
    if (step === 'SEND_SAVED_SELECT') {
      const idx = parseInt(val, 10) - 1;
      if (this.contacts[idx]) {
        const contact = this.contacts[idx];
        this.activeSession.tempData.payee = contact.name;
        this.activeSession.tempData.payeeRef = contact.upiId || contact.phone;
        this.activeSession.tempData.type = 'Saved Contact';
        this.activeSession.step = 'SEND_AMOUNT_INPUT';
        return {
          prompt: `Sending money to ${contact.name}\n(${contact.upiId || contact.phone})\nEnter Amount in ₹ (e.g. 50):`,
          isInput: true,
          inputType: 'number'
        };
      } else {
        return { prompt: 'Invalid selection. Please re-enter number:', isInput: true, inputType: 'number' };
      }
    }

    // 4. MOBILE / UPI / IFSC INPUTS
    if (step === 'SEND_MOBILE_INPUT') {
      if (!val || val.length < 10) {
        return { prompt: 'Please enter a valid 10-digit mobile number:', isInput: true, inputType: 'tel' };
      }
      this.activeSession.tempData.payee = `Mobile: ${val}`;
      this.activeSession.tempData.payeeRef = `${val}@upi`;
      this.activeSession.tempData.type = 'Mobile';
      this.activeSession.step = 'SEND_AMOUNT_INPUT';
      return {
        prompt: `Sending to +91 ${val}\nEnter Amount in ₹ (Limit ₹5000 per USSD txn):`,
        isInput: true,
        inputType: 'number'
      };
    }

    if (step === 'SEND_UPI_INPUT') {
      if (!val || !val.includes('@')) {
        return { prompt: 'Invalid UPI ID format. Must contain "@" (e.g. name@bank):', isInput: true, inputType: 'text' };
      }
      this.activeSession.tempData.payee = val;
      this.activeSession.tempData.payeeRef = val;
      this.activeSession.tempData.type = 'UPI ID';
      this.activeSession.step = 'SEND_AMOUNT_INPUT';
      return {
        prompt: `Paying VPA: ${val}\nEnter Amount in ₹:`,
        isInput: true,
        inputType: 'number'
      };
    }

    if (step === 'SEND_IFSC_INPUT') {
      this.activeSession.tempData.ifsc = val.toUpperCase();
      this.activeSession.step = 'SEND_ACC_INPUT';
      return {
        prompt: `IFSC: ${this.activeSession.tempData.ifsc}\nNow enter Beneficiary Account Number:`,
        isInput: true,
        inputType: 'number'
      };
    }

    if (step === 'SEND_ACC_INPUT') {
      this.activeSession.tempData.acc = val;
      this.activeSession.tempData.payee = `A/C ${val} (${this.activeSession.tempData.ifsc})`;
      this.activeSession.tempData.payeeRef = `${this.activeSession.tempData.ifsc}-${val}`;
      this.activeSession.tempData.type = 'Bank Account';
      this.activeSession.step = 'SEND_AMOUNT_INPUT';
      return {
        prompt: `Enter Amount to transfer to A/C ${val}:`,
        isInput: true,
        inputType: 'number'
      };
    }

    // 5. AMOUNT INPUT
    if (step === 'SEND_AMOUNT_INPUT') {
      const amt = parseFloat(val);
      if (isNaN(amt) || amt <= 0) {
        return { prompt: 'Invalid amount. Enter amount greater than 0:', isInput: true, inputType: 'number' };
      }
      if (amt > 5000) {
        return { prompt: 'RBI/NPCI USSD transaction limit is ₹5,000 per txn.\nEnter amount up to ₹5000:', isInput: true, inputType: 'number' };
      }
      const bank = this.getActiveBank();
      if (amt > bank.balance) {
        return {
          prompt: `Insufficient funds. Available balance: ₹${bank.balance.toFixed(2)}.\nEnter lower amount:`,
          isInput: true,
          inputType: 'number'
        };
      }
      this.activeSession.tempData.amount = amt;
      this.activeSession.step = 'SEND_REMARK_INPUT';
      return {
        prompt: `Paying ₹${amt.toFixed(2)} to ${this.activeSession.tempData.payee}.\nEnter Remark (e.g. Chai, Groceries) or 1 to skip:`,
        isInput: true,
        inputType: 'text'
      };
    }

    // 6. REMARK INPUT
    if (step === 'SEND_REMARK_INPUT') {
      const remark = val === '1' || !val ? 'Payment' : val;
      this.activeSession.tempData.remark = remark;
      this.activeSession.step = 'SEND_PIN';
      const bank = this.getActiveBank();
      return {
        prompt: `Enter 4 or 6 digit UPI PIN to debit ₹${this.activeSession.tempData.amount.toFixed(2)} from ${bank.name} (${bank.accNo}):`,
        isInput: true,
        inputType: 'password'
      };
    }

    // 7. UPI PIN SUBMISSION (EXECUTION)
    if (step === 'SEND_PIN') {
      const bank = this.getActiveBank();
      const enteredPin = val;

      this.emitStep('NPCI_SWITCH', 'NPCI UPI Switch', 'Validating Cryptographic Dual-Factor PIN against Bank CBS');

      if (enteredPin !== bank.pin) {
        this.emitStep('FAIL_CBS', 'Core Banking System', 'Incorrect UPI PIN entered by user', 'ERROR');
        this.activeSession.active = false;
        return {
          prompt: `Transaction Failed!\nIncorrect UPI PIN entered.\nYour balance remains ₹${bank.balance.toFixed(2)}.`,
          isInput: false,
          isFinal: true,
          isError: true
        };
      }

      // Successful debit!
      const amt = this.activeSession.tempData.amount;
      bank.balance -= amt;
      const refNum = `UPI99/${Math.floor(100000 + Math.random() * 900000)}/${bank.code}`;
      const txnRecord = {
        id: refNum,
        type: 'DEBIT',
        amount: amt,
        to: this.activeSession.tempData.payee,
        payeeRef: this.activeSession.tempData.payeeRef,
        method: '*99# NUUP USSD',
        timestamp: new Date().toISOString(),
        remark: this.activeSession.tempData.remark,
        status: 'SUCCESS',
        closingBalance: bank.balance
      };

      this.transactions.unshift(txnRecord);
      this.saveState();

      this.emitStep('SUCCESS_CBS', 'Core Banking System (CBS)', `Account debited ₹${amt}. New Balance: ₹${bank.balance.toFixed(2)}`, 'SUCCESS');
      this.emitStep('RESPONSE_SMS', 'Telecom SMS Gateway', `Carrier SMS dispatched: "Your A/C ${bank.accNo} debited by ₹${amt} on ${new Date().toLocaleDateString()}."`);

      this.activeSession.active = false;
      return {
        prompt: `Your payment of ₹${amt.toFixed(2)} to ${this.activeSession.tempData.payee} was SUCCESSFUL!\n\nRef No: ${refNum}\nUpdated Balance: ₹${bank.balance.toFixed(2)}\nBank: ${bank.name}`,
        isInput: false,
        isFinal: true,
        isSuccess: true,
        txn: txnRecord
      };
    }

    // 8. CHECK BALANCE PIN
    if (step === 'CHECK_BAL_PIN') {
      const bank = this.getActiveBank();
      if (val === bank.pin) {
        this.emitStep('SUCCESS_CBS', 'Core Banking System', `Balance verified for account ${bank.accNo}`, 'SUCCESS');
        this.activeSession.active = false;
        return {
          prompt: `Your Account Balance:\n${bank.name} (${bank.accNo})\nAvailable Balance: ₹${bank.balance.toFixed(2)}\n\nDate: ${new Date().toLocaleDateString()}`,
          isInput: false,
          isFinal: true,
          isSuccess: true
        };
      } else {
        this.emitStep('FAIL_CBS', 'Core Banking System', 'Incorrect UPI PIN for balance check', 'ERROR');
        this.activeSession.active = false;
        return {
          prompt: `Incorrect UPI PIN. Failed to fetch balance for ${bank.name}.`,
          isInput: false,
          isFinal: true,
          isError: true
        };
      }
    }

    // 9. PIN CHANGE FLOW
    if (step === 'CHANGE_PIN_OLD') {
      const bank = this.getActiveBank();
      if (val !== bank.pin) {
        this.activeSession.active = false;
        return { prompt: 'Incorrect existing UPI PIN. Aborted.', isInput: false, isFinal: true, isError: true };
      }
      this.activeSession.step = 'CHANGE_PIN_NEW';
      return { prompt: 'Enter NEW 4 or 6 digit UPI PIN:', isInput: true, inputType: 'password' };
    }

    if (step === 'CHANGE_PIN_NEW') {
      if (!val || val.length < 4 || val.length > 6 || isNaN(val)) {
        return { prompt: 'Invalid format. PIN must be 4 or 6 numeric digits:', isInput: true, inputType: 'password' };
      }
      this.activeSession.tempData.newPin = val;
      this.activeSession.step = 'CHANGE_PIN_CONFIRM';
      return { prompt: 'Confirm NEW UPI PIN by re-entering:', isInput: true, inputType: 'password' };
    }

    if (step === 'CHANGE_PIN_CONFIRM') {
      const bank = this.getActiveBank();
      if (val === this.activeSession.tempData.newPin) {
        bank.pin = val;
        this.saveState();
        this.emitStep('SUCCESS_CBS', 'Core Banking System', 'UPI PIN successfully updated in NPCI Switch', 'SUCCESS');
        this.activeSession.active = false;
        return {
          prompt: `UPI PIN changed successfully for ${bank.name} (${bank.accNo})!`,
          isInput: false,
          isFinal: true,
          isSuccess: true
        };
      } else {
        this.activeSession.active = false;
        return { prompt: 'PIN mismatch. UPI PIN was not updated.', isInput: false, isFinal: true, isError: true };
      }
    }

    // 10. REQUEST MONEY
    if (step === 'REQ_MONEY_INPUT') {
      this.activeSession.tempData.reqPayee = val;
      this.activeSession.step = 'REQ_MONEY_AMOUNT';
      return {
        prompt: `Request money from ${val}:\nEnter Amount in ₹:`,
        isInput: true,
        inputType: 'number'
      };
    }

    if (step === 'REQ_MONEY_AMOUNT') {
      const amt = parseFloat(val);
      this.activeSession.active = false;
      return {
        prompt: `UPI Collect request for ₹${amt.toFixed(2)} sent to ${this.activeSession.tempData.reqPayee} via NPCI Switch.`,
        isInput: false,
        isFinal: true,
        isSuccess: true
      };
    }

    // Default fallback
    this.activeSession.active = false;
    return {
      prompt: 'Session ended.',
      isInput: false,
      isFinal: true
    };
  }

  renderTransactions() {
    this.activeSession.active = false;
    if (!this.transactions.length) {
      return { prompt: 'No recent transactions recorded on this SIM.', isInput: false, isFinal: true };
    }
    const recents = this.transactions.slice(0, 3);
    let str = 'Recent USSD Transactions:\n';
    recents.forEach(t => {
      str += `• ${t.type === 'DEBIT' ? '-' : '+'}₹${t.amount.toFixed(2)} to ${t.to.substring(0, 16)} (${new Date(t.timestamp).toLocaleDateString()})\n`;
    });
    return {
      prompt: str,
      isInput: false,
      isFinal: true
    };
  }

  // Fast payment synthesizer from Smart App / QR code:
  // Converts contact + amount into exact USSD execution
  executeSmartPayment(payeeType, payeeVal, amount, remark) {
    let mmiCode = '';
    if (payeeType === 'mobile') {
      // *99*1*1*<number>*<amount>#
      mmiCode = `*99*1*1*${payeeVal}*${amount}#`;
    } else {
      mmiCode = `*99*1*2#`;
    }
    return this.dial(mmiCode);
  }

  // Top up demo balance or add contact
  topUpBalance(bankId, amount) {
    const bank = this.banks.find(b => b.id === bankId);
    if (bank) {
      bank.balance += amount;
      this.transactions.unshift({
        id: `TOPUP/${Math.floor(100000 + Math.random() * 900000)}`,
        type: 'CREDIT',
        amount: amount,
        to: 'Self Deposit (Simulated)',
        payeeRef: 'Cash Deposit',
        method: 'CBS Simulation',
        timestamp: new Date().toISOString(),
        remark: 'Demo Balance Top-up',
        status: 'SUCCESS',
        closingBalance: bank.balance
      });
      this.saveState();
      return bank.balance;
    }
    return 0;
  }

  addContact(name, phone, upiId) {
    this.contacts.push({ name, phone, upiId, avatar: '👤' });
    this.saveState();
  }
}
