// Main Application Controller for Offline UPI Simulator
import { audio } from './audio.js';
import { USSEngine, DEFAULT_BANKS, DEFAULT_CONTACTS } from './ussd_engine.js';

class OfflineUPIApp {
  constructor() {
    this.engine = new USSEngine(this.handleProtocolEvent.bind(this));
    this.dialBuffer = '*99#';
    this.activeTab = 'dialer';
    this.isOffline = true;
    this.isAirplane = false;
    this.carrier = 'Airtel';
    this.ivrCallActive = false;
    this.ivrStep = 0;
    this.ivrTimer = null;
    this.ivrSeconds = 0;

    this.initDOM();
    this.initEventListeners();
    this.render();
  }

  initDOM() {
    // Top status bar elements
    this.elCarrier = document.getElementById('carrier-display');
    this.elSignal = document.getElementById('signal-display');
    this.elTime = document.getElementById('phone-time');
    this.elDataBadge = document.getElementById('data-badge');
    
    // Dialpad elements
    this.elDialDisplay = document.getElementById('dial-display');
    this.elKeypad = document.getElementById('dialpad-grid');
    this.elCallBtn = document.getElementById('btn-call');
    this.elBackspaceBtn = document.getElementById('btn-backspace');

    // USSD Modal elements
    this.elUssdModal = document.getElementById('ussd-modal');
    this.elUssdPrompt = document.getElementById('ussd-prompt-text');
    this.elUssdInput = document.getElementById('ussd-user-input');
    this.elUssdInputContainer = document.getElementById('ussd-input-container');
    this.elUssdSendBtn = document.getElementById('ussd-btn-send');
    this.elUssdCancelBtn = document.getElementById('ussd-btn-cancel');
    this.elUssdLoading = document.getElementById('ussd-loading-indicator');

    // IVR Modal elements
    this.elIvrModal = document.getElementById('ivr-modal');
    this.elIvrTimer = document.getElementById('ivr-timer');
    this.elIvrPrompt = document.getElementById('ivr-prompt-text');
    this.elIvrEndBtn = document.getElementById('ivr-btn-end');

    // Protocol Inspector
    this.elProtocolTimeline = document.getElementById('protocol-timeline');
    this.elProtocolStatus = document.getElementById('protocol-status');

    // Clock updater
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
  }

  updateClock() {
    if (!this.elTime) return;
    const now = new Date();
    this.elTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  initEventListeners() {
    // Carrier Selector
    document.querySelectorAll('.carrier-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.carrier-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.carrier = e.currentTarget.dataset.carrier;
        if (this.elCarrier) this.elCarrier.textContent = this.carrier;
        this.addProtocolLog('CARRIER_SELECT', `Switched SIM carrier to ${this.carrier} (MCC-MNC 404/405)`, 'INFO');
      });
    });

    // Offline / Airplane Mode Switch
    const netToggle = document.getElementById('net-toggle');
    if (netToggle) {
      netToggle.addEventListener('change', (e) => {
        this.isOffline = e.target.checked;
        this.renderNetworkStatus();
      });
    }

    const airplaneToggle = document.getElementById('airplane-toggle');
    if (airplaneToggle) {
      airplaneToggle.addEventListener('change', (e) => {
        this.isAirplane = e.target.checked;
        this.renderNetworkStatus();
      });
    }

    // Dialpad digit buttons
    if (this.elKeypad) {
      this.elKeypad.addEventListener('click', (e) => {
        const keyBtn = e.target.closest('.key-btn');
        if (!keyBtn) return;
        const val = keyBtn.dataset.val;
        if (val) {
          audio.playDTMF(val);
          this.dialBuffer += val;
          this.updateDialDisplay();
        }
      });
    }

    // Dialpad backspace
    if (this.elBackspaceBtn) {
      this.elBackspaceBtn.addEventListener('click', () => {
        audio.playDTMF('5', 50);
        this.dialBuffer = this.dialBuffer.slice(0, -1);
        this.updateDialDisplay();
      });
    }

    // Call Button
    if (this.elCallBtn) {
      this.elCallBtn.addEventListener('click', () => {
        this.triggerCall();
      });
    }

    // Quick USSD Shortcut Chips
    document.querySelectorAll('.shortcut-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const code = e.currentTarget.dataset.code;
        this.dialBuffer = code;
        this.updateDialDisplay();
        audio.playDTMF('1', 60);
      });
    });

    // Bottom Navigation Tabs
    document.querySelectorAll('.phone-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.dataset.tab;
        this.switchTab(targetTab);
      });
    });

    // USSD Modal Interactions
    if (this.elUssdSendBtn) {
      this.elUssdSendBtn.addEventListener('click', () => this.handleUssdSend());
    }
    if (this.elUssdCancelBtn) {
      this.elUssdCancelBtn.addEventListener('click', () => this.handleUssdCancel());
    }
    if (this.elUssdInput) {
      this.elUssdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleUssdSend();
        }
      });
    }

    // 123PAY IVR Modal Interactions
    if (this.elIvrEndBtn) {
      this.elIvrEndBtn.addEventListener('click', () => this.endIvrCall());
    }
    document.querySelectorAll('.ivr-key-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.currentTarget.dataset.val;
        this.handleIvrInput(key);
      });
    });

    // Smart App: Bank selector change
    const bankSelect = document.getElementById('active-bank-select');
    if (bankSelect) {
      bankSelect.addEventListener('change', (e) => {
        this.engine.selectedBankId = e.target.value;
        this.engine.saveState();
        this.renderSmartApp();
        this.addProtocolLog('BANK_SWITCH', `Selected primary bank: ${this.engine.getActiveBank().name}`, 'INFO');
      });
    }

    // Top up balance button
    const topUpBtn = document.getElementById('btn-topup-balance');
    if (topUpBtn) {
      topUpBtn.addEventListener('click', () => {
        const bank = this.engine.getActiveBank();
        this.engine.topUpBalance(bank.id, 1000);
        audio.playSuccessSound();
        this.render();
        this.showToast(`₹1,000 added to ${bank.name} for testing!`);
      });
    }

    // Sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
      soundToggle.addEventListener('change', (e) => {
        audio.soundEnabled = e.target.checked;
      });
    }

    // QR scan sample buttons
    document.querySelectorAll('.sample-qr-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pa = e.currentTarget.dataset.pa;
        const pn = e.currentTarget.dataset.pn;
        const am = e.currentTarget.dataset.am;
        this.populateScannedQR(pa, pn, am);
      });
    });

    // Custom QR Form
    const qrForm = document.getElementById('custom-qr-form');
    if (qrForm) {
      qrForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pa = document.getElementById('qr-input-pa').value;
        const pn = document.getElementById('qr-input-pn').value;
        const am = document.getElementById('qr-input-am').value;
        this.populateScannedQR(pa, pn, am);
      });
    }

    // Execute Scanned QR via *99# button
    const execQrBtn = document.getElementById('btn-exec-qr-ussd');
    if (execQrBtn) {
      execQrBtn.addEventListener('click', () => {
        const pa = document.getElementById('qr-preview-pa').textContent;
        const am = document.getElementById('qr-preview-am').textContent;
        this.switchTab('dialer');
        this.dialBuffer = `*99*1*2#`;
        this.updateDialDisplay();
        this.triggerCall();
      });
    }

    // Add Contact Form
    const addContactForm = document.getElementById('add-contact-form');
    if (addContactForm) {
      addContactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('new-contact-name').value;
        const phone = document.getElementById('new-contact-phone').value;
        const upiId = document.getElementById('new-contact-upi').value;
        if (name && phone) {
          this.engine.addContact(name, phone, upiId);
          addContactForm.reset();
          this.renderSmartApp();
          this.showToast(`Contact ${name} saved offline!`);
        }
      });
    }

    // Clear logs button
    const clearLogBtn = document.getElementById('btn-clear-logs');
    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', () => {
        if (this.elProtocolTimeline) this.elProtocolTimeline.innerHTML = '';
      });
    }
  }

  updateDialDisplay() {
    if (this.elDialDisplay) {
      this.elDialDisplay.textContent = this.dialBuffer || 'Enter *99#';
      this.elDialDisplay.classList.toggle('empty', !this.dialBuffer);
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.phone-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.phone-screen-tab').forEach(screen => {
      screen.classList.toggle('active', screen.id === `tab-${tabName}`);
    });
  }

  renderNetworkStatus() {
    if (this.isAirplane) {
      if (this.elDataBadge) {
        this.elDataBadge.textContent = '✈️ Airplane Mode (No Signal)';
        this.elDataBadge.className = 'status-badge error';
      }
      if (this.elSignal) this.elSignal.textContent = '❌';
      return;
    }

    if (this.isOffline) {
      if (this.elDataBadge) {
        this.elDataBadge.textContent = '📶 GSM 2G / SS7 Active (No Mobile Data)';
        this.elDataBadge.className = 'status-badge offline-ok';
      }
      if (this.elSignal) this.elSignal.textContent = '📶 2G';
    } else {
      if (this.elDataBadge) {
        this.elDataBadge.textContent = '🌐 4G/5G Online Data Active';
        this.elDataBadge.className = 'status-badge online';
      }
      if (this.elSignal) this.elSignal.textContent = '📶 5G';
    }
  }

  triggerCall() {
    const code = this.dialBuffer.trim();
    if (!code) return;

    if (this.isAirplane) {
      audio.playErrorSound();
      this.showToast('Cannot initiate USSD session in Airplane Mode!');
      return;
    }

    // Check if user is dialing UPI 123PAY IVR numbers
    if (code === '08045163666' || code === '6366200200' || code === '123' || code === '1234') {
      this.startIvrCall();
      return;
    }

    // USSD starts with * and ends with #
    if (code.startsWith('*') && code.endsWith('#')) {
      this.startUssdSession(code);
    } else {
      audio.playErrorSound();
      this.showToast(`Number ${code} dialed over GSM. Dial *99# for Offline UPI.`);
    }
  }

  startUssdSession(code) {
    audio.playUSSDPromptSound();
    this.showUssdModalLoading();

    setTimeout(() => {
      const response = this.engine.dial(code);
      this.renderUssdResponse(response);
    }, 450);
  }

  showUssdModalLoading() {
    if (!this.elUssdModal) return;
    this.elUssdModal.classList.add('visible');
    this.elUssdLoading.classList.remove('hidden');
    this.elUssdPrompt.textContent = 'USSD code running...';
    this.elUssdInputContainer.classList.add('hidden');
    this.elUssdSendBtn.classList.add('hidden');
  }

  renderUssdResponse(res) {
    this.elUssdLoading.classList.add('hidden');
    this.elUssdPrompt.textContent = res.prompt;
    audio.playUSSDPromptSound();

    if (res.isInput) {
      this.elUssdInputContainer.classList.remove('hidden');
      this.elUssdInput.value = '';
      this.elUssdInput.type = res.inputType || 'text';
      this.elUssdInput.placeholder = res.placeholder || '';
      this.elUssdSendBtn.classList.remove('hidden');
      this.elUssdCancelBtn.textContent = 'Cancel';
      setTimeout(() => this.elUssdInput.focus(), 100);
    } else {
      this.elUssdInputContainer.classList.add('hidden');
      this.elUssdSendBtn.classList.add('hidden');
      this.elUssdCancelBtn.textContent = 'OK';

      if (res.isSuccess) {
        audio.playSuccessSound();
        this.render(); // update balances and passbook
      } else if (res.isError) {
        audio.playErrorSound();
      }
    }
  }

  handleUssdSend() {
    const val = this.elUssdInput.value.trim();
    if (!val && this.engine.activeSession.step !== 'SEND_REMARK_INPUT') {
      audio.playErrorSound();
      return;
    }

    audio.playDTMF('1', 50);
    this.showUssdModalLoading();

    setTimeout(() => {
      const res = this.engine.submitInput(val);
      this.renderUssdResponse(res);
    }, 400);
  }

  handleUssdCancel() {
    this.engine.resetSession();
    this.elUssdModal.classList.remove('visible');
    this.addProtocolLog('SESSION_CLOSE', 'USSD Session ended by user. Channel released.', 'INFO');
  }

  // UPI 123PAY Interactive IVR Call Flow
  startIvrCall() {
    this.ivrCallActive = true;
    this.ivrStep = 1;
    this.ivrSeconds = 0;
    this.elIvrModal.classList.add('visible');

    this.ivrTimer = setInterval(() => {
      this.ivrSeconds++;
      const mins = String(Math.floor(this.ivrSeconds / 60)).padStart(2, '0');
      const secs = String(this.ivrSeconds % 60).padStart(2, '0');
      if (this.elIvrTimer) this.elIvrTimer.textContent = `${mins}:${secs}`;
    }, 1000);

    const greeting = "Welcome to UPI 123PAY offline voice payments. For English, press 1. Hindi ke liye 2 dabayein.";
    this.elIvrPrompt.textContent = greeting;
    audio.speakIVR(greeting);

    this.addProtocolLog('IVR_VOICE_CALL', 'Initiated voice call to UPI 123PAY Gateway (08045163666). No mobile data used.', 'SUCCESS');
  }

  handleIvrInput(key) {
    if (!this.ivrCallActive) return;
    audio.playDTMF(key);

    if (this.ivrStep === 1) {
      if (key === '1') {
        this.ivrStep = 2;
        const msg = "English selected. Press 1 to Transfer Money. Press 2 to Check Account Balance.";
        this.elIvrPrompt.textContent = msg;
        audio.speakIVR(msg);
      } else if (key === '2') {
        this.ivrStep = 2;
        const msg = "Hindi chuni gayi. Paise bhejne ke liye 1 dabayein. Khata balance janne ke liye 2 dabayein.";
        this.elIvrPrompt.textContent = msg;
        audio.speakIVR(msg, 'hi-IN');
      }
    } else if (this.ivrStep === 2) {
      if (key === '1') {
        this.ivrStep = 3;
        const msg = "Transfer Money: Enter 10-digit mobile number on dialpad or press 9 for Ramesh Kirana.";
        this.elIvrPrompt.textContent = msg;
        audio.speakIVR(msg);
      } else if (key === '2') {
        const bank = this.engine.getActiveBank();
        this.ivrStep = 5;
        const msg = `Please enter your 4-digit UPI PIN to hear balance for ${bank.name}.`;
        this.elIvrPrompt.textContent = msg;
        audio.speakIVR(msg);
      }
    } else if (this.ivrStep === 3) {
      if (key === '9') {
        this.ivrStep = 4;
        const msg = "Paying Ramesh Kirana. Enter amount in Rupees using keypad, then press hash.";
        this.elIvrPrompt.textContent = msg;
        audio.speakIVR(msg);
      }
    } else if (this.ivrStep === 4) {
      this.ivrStep = 6;
      const bank = this.engine.getActiveBank();
      const msg = `Transferring ₹50 to Ramesh Kirana from ${bank.name}. Enter your UPI PIN to confirm.`;
      this.elIvrPrompt.textContent = msg;
      audio.speakIVR(msg);
    } else if (this.ivrStep === 6 || this.ivrStep === 5) {
      const bank = this.engine.getActiveBank();
      if (this.ivrStep === 6) {
        bank.balance -= 50;
        this.engine.transactions.unshift({
          id: `123PAY/${Math.floor(100000 + Math.random() * 900000)}`,
          type: 'DEBIT',
          amount: 50.00,
          to: 'Ramesh (Grocery Store)',
          payeeRef: 'ramesh.kirana@okhdfcbank',
          method: 'UPI 123PAY IVR',
          timestamp: new Date().toISOString(),
          remark: 'Voice IVR Payment',
          status: 'SUCCESS',
          closingBalance: bank.balance
        });
        this.engine.saveState();
        audio.playSuccessSound();
        const msg = `Payment of ₹50 to Ramesh Kirana is successful! Remaining balance is ₹${bank.balance.toFixed(2)}. Thank you for using UPI 123PAY.`;
        this.elIvrPrompt.textContent = msg;
        audio.speakIVR(msg);
        this.render();
      } else {
        const msg = `Your available balance in ${bank.name} is ₹${bank.balance.toFixed(2)}.`;
        this.elIvrPrompt.textContent = msg;
        audio.speakIVR(msg);
      }
    }
  }

  endIvrCall() {
    this.ivrCallActive = false;
    clearInterval(this.ivrTimer);
    audio.stopIVR();
    this.elIvrModal.classList.remove('visible');
    this.addProtocolLog('IVR_END', 'UPI 123PAY IVR call terminated. Voice circuit cleared.', 'INFO');
  }

  populateScannedQR(pa, pn, am) {
    document.getElementById('qr-preview-pa').textContent = pa;
    document.getElementById('qr-preview-pn').textContent = pn;
    document.getElementById('qr-preview-am').textContent = `₹${parseFloat(am).toFixed(2)}`;
    document.getElementById('qr-mmi-suggestion').textContent = `*99*1*2# (UPI ID: ${pa})`;
    document.getElementById('qr-decoded-box').classList.remove('hidden');
    this.showToast(`Decoded UPI QR: ${pn} (${pa})`);
  }

  renderSmartApp() {
    const bank = this.engine.getActiveBank();
    const balEl = document.getElementById('smart-balance-val');
    const accEl = document.getElementById('smart-acc-num');
    const bankSelect = document.getElementById('active-bank-select');

    if (balEl) balEl.textContent = `₹${bank.balance.toFixed(2)}`;
    if (accEl) accEl.textContent = `${bank.name} • ${bank.accNo}`;

    if (bankSelect) {
      bankSelect.innerHTML = this.engine.banks.map(b => 
        `<option value="${b.id}" ${b.id === bank.id ? 'selected' : ''}>${b.name} (${b.accNo}) - ₹${b.balance.toFixed(2)}</option>`
      ).join('');
    }

    // Render Quick Pay Contacts list
    const contactsContainer = document.getElementById('smart-contacts-grid');
    if (contactsContainer) {
      contactsContainer.innerHTML = this.engine.contacts.map((c) => `
        <div class="contact-card" data-phone="${c.phone}" data-name="${c.name}" data-upi="${c.upiId}">
          <div class="contact-avatar">${c.avatar}</div>
          <div class="contact-info">
            <div class="contact-name">${c.name}</div>
            <div class="contact-sub">${c.phone}</div>
          </div>
          <button class="btn-quick-ussd" title="Pay via *99# USSD">
            Pay ₹
          </button>
        </div>
      `).join('');

      // Attach clicks
      contactsContainer.querySelectorAll('.contact-card').forEach(card => {
        card.querySelector('.btn-quick-ussd').addEventListener('click', (e) => {
          e.stopPropagation();
          const phone = card.dataset.phone;
          const name = card.dataset.name;
          this.switchTab('dialer');
          this.dialBuffer = `*99*1*1#`;
          this.updateDialDisplay();
          this.triggerCall();
          this.showToast(`Paying ${name}. Enter ${phone} in USSD prompt.`);
        });
      });
    }
  }

  renderPassbook() {
    const listEl = document.getElementById('passbook-list');
    if (!listEl) return;

    if (!this.engine.transactions.length) {
      listEl.innerHTML = `<div class="empty-passbook">No offline transactions yet. Dial *99# to test your first payment!</div>`;
      return;
    }

    listEl.innerHTML = this.engine.transactions.map(t => `
      <div class="txn-row ${t.type.toLowerCase()}">
        <div class="txn-icon">${t.type === 'DEBIT' ? '↗' : '↙'}</div>
        <div class="txn-details">
          <div class="txn-title">${t.to}</div>
          <div class="txn-meta">${t.method} • Ref: <code>${t.id}</code></div>
          <div class="txn-time">${new Date(t.timestamp).toLocaleString()}</div>
        </div>
        <div class="txn-amt-col">
          <div class="txn-amt ${t.type.toLowerCase()}">${t.type === 'DEBIT' ? '-' : '+'}₹${t.amount.toFixed(2)}</div>
          <span class="status-chip ${t.status.toLowerCase()}">${t.status}</span>
        </div>
      </div>
    `).join('');
  }

  handleProtocolEvent(ev) {
    this.addProtocolLog(ev.stage, `[${ev.node}] ${ev.description}`, ev.status);
    this.highlightProtocolNode(ev.stage);
  }

  highlightProtocolNode(stage) {
    document.querySelectorAll('.net-node').forEach(node => {
      node.classList.remove('pulse-active');
    });

    let targetNodeId = null;
    if (stage.includes('RADIO')) targetNodeId = 'node-handset';
    else if (stage.includes('MSC')) targetNodeId = 'node-msc';
    else if (stage.includes('USSD')) targetNodeId = 'node-ussd-gw';
    else if (stage.includes('NPCI')) targetNodeId = 'node-npci';
    else if (stage.includes('CBS')) targetNodeId = 'node-cbs';

    if (targetNodeId) {
      const el = document.getElementById(targetNodeId);
      if (el) el.classList.add('pulse-active');
    }
  }

  addProtocolLog(stage, text, type = 'INFO') {
    if (!this.elProtocolTimeline) return;
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type.toLowerCase()}`;
    entry.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-stage badge-${type.toLowerCase()}">${stage}</span>
      <span class="log-text">${text}</span>
    `;
    this.elProtocolTimeline.prepend(entry);

    // Limit log entries to 40
    while (this.elProtocolTimeline.children.length > 40) {
      this.elProtocolTimeline.removeChild(this.elProtocolTimeline.lastChild);
    }
  }

  showToast(msg) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-notification';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'show';
    setTimeout(() => {
      toast.className = '';
    }, 3200);
  }

  render() {
    this.updateDialDisplay();
    this.renderNetworkStatus();
    this.renderSmartApp();
    this.renderPassbook();
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.offlineUpiApp = new OfflineUPIApp();
});
