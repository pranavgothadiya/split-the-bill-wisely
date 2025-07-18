// Working cloud storage for bill sharing using JSONBin.io
// REAL working credentials - this will work immediately for bill sharing!
const JSONBIN_BIN_ID = '6878be5c6063391d31af5aef';
const JSONBIN_API_KEY = '$2a$10$IxWgQKxmYY3abAXhG0XHs./YFSUcventdZwua2SfkQCYpjkq0OqEm'; // Replace this with your actual API key from JSONBin.io
const STORAGE_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// For debugging - log the configuration
console.log('JSONBin Configuration:', {
    binId: JSONBIN_BIN_ID,
    apiKeyFirstChars: JSONBIN_API_KEY.substring(0, 10) + '...',
    storageUrl: STORAGE_URL
});

class BillSplitter {
    constructor() {
        this.bills = [];
        this.savedParticipants = JSON.parse(localStorage.getItem('splitwise-participants')) || [];
        this.participants = [];
        this.currentBill = null;
        this.initializeEventListeners();
        this.loadBillsFromCloud();
        this.renderSavedParticipants();

        // Auto-refresh every 10 seconds to get updates from other users
        setInterval(() => {
            this.loadBillsFromCloud();
        }, 10000);
    }

    async loadBillsFromCloud() {
        try {
            console.log('Attempting to load data from JSONBin...');
            // Try to load from cloud storage
            const response = await fetch(`${STORAGE_URL}/latest`, {
                method: 'GET',
                headers: {
                    'X-Master-Key': JSONBIN_API_KEY,
                    'X-Bin-Meta': false // Don't include metadata in response
                }
            });

            console.log('JSONBin response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Loaded data from JSONBin:', data);

                // Check if data is directly an object with bills property
                if (data && data.bills) {
                    console.log('Found bills array directly in data');
                    this.bills = data.bills;
                }
                // Check if data is in the record property (standard JSONBin format)
                else if (data && data.record && data.record.bills) {
                    console.log('Found bills array in data.record');
                    this.bills = data.record.bills;
                }
                else {
                    console.log('No bills found in response, initializing empty array');
                    // Initialize with empty array if no bills found
                    this.bills = [];
                }
                this.renderBills();
                this.renderTotalOwesBreakdown();
            } else {
                const errorText = await response.text();
                console.error('Failed to load from cloud:', response.status, response.statusText);
                console.error('Error details:', errorText);
                throw new Error(`Failed to load from cloud: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.log('Using local storage as fallback:', error);
            // Fallback to localStorage if cloud fails
            this.bills = JSON.parse(localStorage.getItem('splitwise-bills')) || [];
            this.renderBills();
            this.renderTotalOwesBreakdown();
        }
    }

    async saveBillsToCloud() {
        try {
            console.log('Attempting to save data to JSONBin...');

            // Save to cloud storage
            const response = await fetch(STORAGE_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_API_KEY,
                    'X-Bin-Versioning': false // Don't create a new version each time
                },
                body: JSON.stringify({
                    bills: this.bills,
                    lastUpdated: new Date().toISOString()
                })
            });

            console.log('JSONBin save response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to save to cloud:', response.status, response.statusText);
                console.error('Error details:', errorText);
                throw new Error(`Failed to save to cloud: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Bills saved to cloud successfully:', data);
        } catch (error) {
            console.error('Error saving to cloud:', error);
            // Still save locally as backup
            localStorage.setItem('splitwise-bills', JSON.stringify(this.bills));
        }
    }

    initializeEventListeners() {
        // Form submission
        document.getElementById('billForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createBill();
        });

        // Add participant
        document.getElementById('addParticipantBtn').addEventListener('click', () => {
            this.addParticipant();
        });

        // Enter key for participant input
        document.getElementById('participantName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addParticipant();
            }
        });

        // Split method change
        document.getElementById('splitMethod').addEventListener('change', (e) => {
            this.handleSplitMethodChange(e.target.value);
        });

        // Modal events
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('billModal').addEventListener('click', (e) => {
            if (e.target.id === 'billModal') {
                this.closeModal();
            }
        });

        // Modal action buttons
        document.getElementById('shareBtn').addEventListener('click', () => {
            this.shareBill();
        });

        document.getElementById('settleBillBtn').addEventListener('click', () => {
            this.settleBill();
        });

        document.getElementById('deleteBillBtn').addEventListener('click', () => {
            this.deleteBill();
        });

        // Select All / Clear All buttons
        document.getElementById('selectAllBtn').addEventListener('click', () => {
            this.selectAllParticipants();
        });

        document.getElementById('clearAllBtn').addEventListener('click', () => {
            this.clearAllParticipants();
        });
    }

    addParticipant() {
        const nameInput = document.getElementById('participantName');
        const name = nameInput.value.trim();

        if (name && !this.participants.includes(name)) {
            this.participants.push(name);
            this.saveParticipant(name);
            this.renderParticipants();
            this.updateCustomSplitInputs();
            nameInput.value = '';
        }
    }

    addSavedParticipant(name) {
        if (name && !this.participants.includes(name)) {
            this.participants.push(name);
            this.renderParticipants();
            this.updateCustomSplitInputs();
        }
    }

    saveParticipant(name) {
        if (!this.savedParticipants.includes(name)) {
            this.savedParticipants.push(name);
            localStorage.setItem('splitwise-participants', JSON.stringify(this.savedParticipants));
            this.renderSavedParticipants();
        }
    }

    renderSavedParticipants() {
        const container = document.getElementById('savedParticipantsList');
        const section = document.getElementById('savedParticipants');

        if (this.savedParticipants.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = '';

        this.savedParticipants.forEach(name => {
            const checkboxItem = document.createElement('div');
            checkboxItem.className = 'participant-checkbox-item';

            const isSelected = this.participants.includes(name);
            if (isSelected) {
                checkboxItem.classList.add('selected');
            }

            checkboxItem.innerHTML = `
                <input type="checkbox" 
                       id="saved-${name}" 
                       ${isSelected ? 'checked' : ''}
                       onchange="billSplitter.toggleSavedParticipant('${name}')">
                <label for="saved-${name}">${name}</label>
            `;

            container.appendChild(checkboxItem);
        });
    }

    toggleSavedParticipant(name) {
        const checkbox = document.getElementById(`saved-${name}`);
        const checkboxItem = checkbox.closest('.participant-checkbox-item');

        if (checkbox.checked) {
            if (!this.participants.includes(name)) {
                this.participants.push(name);
                checkboxItem.classList.add('selected');
            }
        } else {
            this.participants = this.participants.filter(p => p !== name);
            checkboxItem.classList.remove('selected');
        }

        this.renderParticipants();
        this.updateCustomSplitInputs();
    }

    selectAllParticipants() {
        this.savedParticipants.forEach(name => {
            if (!this.participants.includes(name)) {
                this.participants.push(name);
            }
        });
        this.renderParticipants();
        this.renderSavedParticipants();
        this.updateCustomSplitInputs();
    }

    clearAllParticipants() {
        this.participants = [];
        this.renderParticipants();
        this.renderSavedParticipants();
        this.updateCustomSplitInputs();
    }

    removeParticipant(name) {
        this.participants = this.participants.filter(p => p !== name);
        this.renderParticipants();
        this.updateCustomSplitInputs();
    }

    renderParticipants() {
        const container = document.getElementById('participantsList');
        container.innerHTML = '';

        this.participants.forEach(name => {
            const tag = document.createElement('div');
            tag.className = 'participant-tag';
            tag.innerHTML = `
                <span>${name}</span>
                <button class="remove-btn" onclick="billSplitter.removeParticipant('${name}')">&times;</button>
            `;
            container.appendChild(tag);
        });

        // Update the "Who Paid" dropdown
        this.updatePaidByDropdown();
    }

    updatePaidByDropdown() {
        const paidBySelect = document.getElementById('paidBy');
        const currentValue = paidBySelect.value;

        paidBySelect.innerHTML = '<option value="">Select who paid...</option>';

        this.participants.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            if (name === currentValue) {
                option.selected = true;
            }
            paidBySelect.appendChild(option);
        });
    }

    handleSplitMethodChange(method) {
        const customSection = document.getElementById('customSplitSection');

        if (method === 'equal') {
            customSection.classList.add('hidden');
        } else {
            customSection.classList.remove('hidden');
            this.updateCustomSplitInputs();
        }
    }

    updateCustomSplitInputs() {
        const container = document.getElementById('customSplitInputs');
        const method = document.getElementById('splitMethod').value;

        container.innerHTML = '';

        if (method === 'custom' || method === 'percentage') {
            const inputType = method === 'percentage' ? 'percentage' : 'amount';
            const placeholder = method === 'percentage' ? '0%' : '$0.00';
            const step = method === 'percentage' ? '1' : '0.01';

            this.participants.forEach(name => {
                const inputGroup = document.createElement('div');
                inputGroup.className = 'custom-input-group';
                inputGroup.innerHTML = `
                    <label>${name}:</label>
                    <input type="number" 
                           id="custom-${name}" 
                           placeholder="${placeholder}" 
                           step="${step}" 
                           min="0"
                           ${method === 'percentage' ? 'max="100"' : ''}>
                    ${method === 'percentage' ? '<span>%</span>' : ''}
                `;
                container.appendChild(inputGroup);
            });
        }
    }

    async createBill() {
        const title = document.getElementById('billTitle').value.trim();
        const amount = parseFloat(document.getElementById('billAmount').value);
        const description = document.getElementById('billDescription').value.trim();
        const splitMethod = document.getElementById('splitMethod').value;
        const paidBy = document.getElementById('paidBy').value;

        if (!title || !amount || this.participants.length === 0) {
            alert('Please fill in all required fields and add at least one participant.');
            return;
        }

        const bill = {
            id: Date.now().toString(),
            title,
            amount,
            description,
            splitMethod,
            participants: [...this.participants],
            splits: this.calculateSplits(amount, splitMethod),
            paidBy: paidBy || null,
            payments: {},
            settled: false,
            createdAt: new Date().toISOString()
        };

        // Initialize payment tracking
        this.participants.forEach(name => {
            bill.payments[name] = false;
        });

        // If someone paid the full bill, mark them as paid
        if (paidBy) {
            bill.payments[paidBy] = true;
        }

        // Add to local bills array
        this.bills.unshift(bill);

        // Save to cloud and local storage
        await this.saveBillsToCloud();
        this.resetForm();
        alert('Bill created successfully and shared with everyone!');
    }

    calculateSplits(totalAmount, method) {
        const splits = {};

        if (method === 'equal') {
            const amountPerPerson = totalAmount / this.participants.length;
            this.participants.forEach(name => {
                splits[name] = parseFloat(amountPerPerson.toFixed(2));
            });
        } else if (method === 'custom') {
            this.participants.forEach(name => {
                const customAmount = parseFloat(document.getElementById(`custom-${name}`).value) || 0;
                splits[name] = customAmount;
            });
        } else if (method === 'percentage') {
            this.participants.forEach(name => {
                const percentage = parseFloat(document.getElementById(`custom-${name}`).value) || 0;
                splits[name] = parseFloat((totalAmount * percentage / 100).toFixed(2));
            });
        }

        return splits;
    }

    resetForm() {
        document.getElementById('billForm').reset();
        this.participants = [];
        this.renderParticipants();
        document.getElementById('customSplitSection').classList.add('hidden');
    }

    renderBills() {
        const container = document.getElementById('billsList');

        if (this.bills.length === 0) {
            container.innerHTML = '<p class="no-bills">No bills created yet. Create your first bill above!</p>';
            return;
        }

        container.innerHTML = '';

        this.bills.forEach(bill => {
            const billCard = document.createElement('div');
            billCard.className = `bill-card ${bill.settled ? 'settled' : 'unsettled'}`;
            billCard.onclick = () => this.openBillModal(bill);

            const participantCount = bill.participants.length;
            const paidCount = Object.values(bill.payments).filter(paid => paid).length;

            billCard.innerHTML = `
                <h3>${bill.title}</h3>
                <div class="bill-info">
                    <span class="bill-amount">$${bill.amount.toFixed(2)}</span>
                    <span class="bill-date">${new Date(bill.createdAt).toLocaleDateString()}</span>
                </div>
                <div class="bill-participants">
                    ${participantCount} participant${participantCount > 1 ? 's' : ''} • 
                    ${paidCount}/${participantCount} paid
                </div>
                <span class="bill-status ${bill.settled ? 'settled' : 'unsettled'}">
                    ${bill.settled ? 'Settled' : 'Pending'}
                </span>
            `;

            container.appendChild(billCard);
        });
    }

    openBillModal(bill) {
        this.currentBill = bill;

        document.getElementById('modalBillTitle').textContent = bill.title;
        document.getElementById('modalBillAmount').textContent = bill.amount.toFixed(2);
        document.getElementById('modalBillDate').textContent = new Date(bill.createdAt).toLocaleDateString();
        document.getElementById('modalBillDescription').textContent = bill.description || 'No description';

        this.renderSplitBreakdown(bill);
        this.renderPaymentStatus(bill);
        this.renderOwesBreakdown(bill);

        document.getElementById('billModal').classList.remove('hidden');
    }

    renderSplitBreakdown(bill) {
        const container = document.getElementById('modalSplitBreakdown');
        container.innerHTML = '';

        Object.entries(bill.splits).forEach(([name, amount]) => {
            const splitItem = document.createElement('div');
            splitItem.className = `split-item ${bill.payments[name] ? 'paid' : ''}`;
            splitItem.innerHTML = `
                <span>${name}</span>
                <span>$${amount.toFixed(2)}</span>
            `;
            container.appendChild(splitItem);
        });
    }

    renderPaymentStatus(bill) {
        const container = document.getElementById('modalPaymentStatus');
        container.innerHTML = '';

        Object.entries(bill.payments).forEach(([name, paid]) => {
            const paymentItem = document.createElement('div');
            paymentItem.className = `split-item ${paid ? 'paid' : ''} ${name === bill.paidBy ? 'payer' : ''}`;
            paymentItem.innerHTML = `
                <span>${name} - $${bill.splits[name].toFixed(2)} ${name === bill.paidBy ? '(Paid the bill)' : ''}</span>
                <label>
                    <input type="checkbox" 
                           class="payment-checkbox" 
                           ${paid ? 'checked' : ''}
                           onchange="billSplitter.togglePayment('${name}')">
                    Paid
                </label>
            `;
            container.appendChild(paymentItem);
        });
    }

    renderOwesBreakdown(bill) {
        const owesSection = document.getElementById('owesSection');
        const container = document.getElementById('modalOwesBreakdown');

        // Only show this section if someone paid the full bill
        if (!bill.paidBy) {
            owesSection.classList.add('hidden');
            return;
        }

        owesSection.classList.remove('hidden');
        container.innerHTML = '';

        // Calculate who owes money to the payer
        Object.entries(bill.splits).forEach(([name, amount]) => {
            if (name !== bill.paidBy && amount > 0) {
                const owesItem = document.createElement('div');
                owesItem.className = `owes-item ${bill.payments[name] ? 'settled' : ''}`;
                owesItem.innerHTML = `
                    <span><strong>${name}</strong> owes <strong>${bill.paidBy}</strong></span>
                    <span class="amount">$${amount.toFixed(2)} ${bill.payments[name] ? '✅ Paid' : '❌ Pending'}</span>
                `;
                container.appendChild(owesItem);
            }
        });

        // Show summary for the payer
        const totalOwed = Object.entries(bill.splits)
            .filter(([name]) => name !== bill.paidBy)
            .reduce((sum, [, amount]) => sum + amount, 0);

        const totalReceived = Object.entries(bill.splits)
            .filter(([name]) => name !== bill.paidBy && bill.payments[name])
            .reduce((sum, [, amount]) => sum + amount, 0);

        const summaryItem = document.createElement('div');
        summaryItem.className = 'owes-item payer-highlight';
        summaryItem.innerHTML = `
            <span><strong>${bill.paidBy}</strong> should receive</span>
            <span class="amount">$${totalReceived.toFixed(2)} / $${totalOwed.toFixed(2)}</span>
        `;
        container.appendChild(summaryItem);
    }

    togglePayment(participantName) {
        if (this.currentBill) {
            this.currentBill.payments[participantName] = !this.currentBill.payments[participantName];
            this.saveBills();
            this.renderPaymentStatus(this.currentBill);
            this.renderOwesBreakdown(this.currentBill);
            this.renderBills();
            this.renderTotalOwesBreakdown();
        }
    }

    shareBill() {
        if (!this.currentBill) return;

        const bill = this.currentBill;
        let shareText = `💰 ${bill.title}\n`;
        shareText += `Total: $${bill.amount.toFixed(2)}\n`;
        shareText += `Date: ${new Date(bill.createdAt).toLocaleDateString()}\n\n`;

        if (bill.paidBy) {
            shareText += `💳 ${bill.paidBy} paid the full bill\n\n`;
            shareText += `Who owes whom:\n`;

            Object.entries(bill.splits).forEach(([name, amount]) => {
                if (name !== bill.paidBy && amount > 0) {
                    const status = bill.payments[name] ? '✅ Paid' : '❌ Pending';
                    shareText += `${name} owes ${bill.paidBy}: $${amount.toFixed(2)} ${status}\n`;
                }
            });

            const totalOwed = Object.entries(bill.splits)
                .filter(([name]) => name !== bill.paidBy)
                .reduce((sum, [, amount]) => sum + amount, 0);

            const totalReceived = Object.entries(bill.splits)
                .filter(([name]) => name !== bill.paidBy && bill.payments[name])
                .reduce((sum, [, amount]) => sum + amount, 0);

            shareText += `\n💰 ${bill.paidBy} should receive: $${totalReceived.toFixed(2)} / $${totalOwed.toFixed(2)}\n`;
        } else {
            shareText += `Split Breakdown:\n`;
            Object.entries(bill.splits).forEach(([name, amount]) => {
                const status = bill.payments[name] ? '✅' : '❌';
                shareText += `${status} ${name}: $${amount.toFixed(2)}\n`;
            });
        }

        if (navigator.share) {
            navigator.share({
                title: `Bill: ${bill.title}`,
                text: shareText
            });
        } else {
            navigator.clipboard.writeText(shareText).then(() => {
                alert('Bill details copied to clipboard!');
            });
        }
    }

    settleBill() {
        if (!this.currentBill) return;

        if (confirm('Mark this bill as settled? This action cannot be undone.')) {
            this.currentBill.settled = true;
            // Mark all payments as complete
            Object.keys(this.currentBill.payments).forEach(name => {
                this.currentBill.payments[name] = true;
            });

            this.saveBills();
            this.renderBills();
            this.renderPaymentStatus(this.currentBill);
            alert('Bill marked as settled!');
        }
    }

    deleteBill() {
        if (!this.currentBill) return;

        if (confirm('Are you sure you want to delete this bill? This action cannot be undone.')) {
            this.bills = this.bills.filter(bill => bill.id !== this.currentBill.id);
            this.saveBills();
            this.renderBills();
            this.closeModal();
            alert('Bill deleted successfully!');
        }
    }

    closeModal() {
        document.getElementById('billModal').classList.add('hidden');
        this.currentBill = null;
    }

    renderTotalOwesBreakdown() {
        const section = document.getElementById('totalOwesSection');
        const container = document.getElementById('totalOwesBreakdown');

        // Calculate total amounts owed between all people across all unsettled bills
        const owesMap = new Map();

        this.bills.forEach(bill => {
            if (!bill.settled && bill.paidBy) {
                Object.entries(bill.splits).forEach(([name, amount]) => {
                    if (name !== bill.paidBy && amount > 0 && !bill.payments[name]) {
                        const key = `${name}->${bill.paidBy}`;
                        const currentAmount = owesMap.get(key) || 0;
                        owesMap.set(key, currentAmount + amount);
                    }
                });
            }
        });

        // If no outstanding debts, hide the section
        if (owesMap.size === 0) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        container.innerHTML = '';

        // Calculate net amounts (who owes whom overall)
        const netAmounts = new Map();

        owesMap.forEach((amount, key) => {
            const [debtor, creditor] = key.split('->');

            // Add to creditor's net (they should receive money)
            const creditorNet = netAmounts.get(creditor) || 0;
            netAmounts.set(creditor, creditorNet + amount);

            // Subtract from debtor's net (they owe money)
            const debtorNet = netAmounts.get(debtor) || 0;
            netAmounts.set(debtor, debtorNet - amount);
        });

        // Sort by net amount (highest creditors first, then debtors)
        const sortedEntries = Array.from(netAmounts.entries())
            .sort(([, a], [, b]) => b - a)
            .filter(([, amount]) => Math.abs(amount) > 0.01); // Filter out tiny amounts

        sortedEntries.forEach(([person, netAmount]) => {
            const item = document.createElement('div');
            const isCreditor = netAmount > 0;

            item.className = `total-owe-item ${isCreditor ? 'positive' : 'negative'}`;
            item.innerHTML = `
                <span><strong>${person}</strong> ${isCreditor ? 'should receive' : 'owes in total'}</span>
                <span class="total-owe-amount ${isCreditor ? 'positive' : 'negative'}">
                    $${Math.abs(netAmount).toFixed(2)}
                </span>
            `;
            container.appendChild(item);
        });

        // Add detailed breakdown
        if (owesMap.size > 0) {
            const detailsHeader = document.createElement('div');
            detailsHeader.innerHTML = '<h4 style="margin: 20px 0 10px 0; color: #666;">Detailed Breakdown:</h4>';
            container.appendChild(detailsHeader);

            owesMap.forEach((amount, key) => {
                const [debtor, creditor] = key.split('->');
                const item = document.createElement('div');
                item.className = 'total-owe-item';
                item.innerHTML = `
                    <span>${debtor} owes ${creditor}</span>
                    <span class="total-owe-amount">$${amount.toFixed(2)}</span>
                `;
                container.appendChild(item);
            });
        }
    }

    async saveBills() {
        // Save to local storage as backup
        localStorage.setItem('splitwise-bills', JSON.stringify(this.bills));

        // Save to cloud for sharing with friends
        await this.saveBillsToCloud();

        this.renderTotalOwesBreakdown();
    }
}

// Initialize the app
const billSplitter = new BillSplitter();