// ================= USER SETTINGS =================
const CONFIG = {
    API_TOKEN: "DcvgxmW376P871t",
    APP_ID: 1089,
    MARKET: "1HZ100V",
    WINDOW: 20,
    EMA_ALPHA: 0.2,
    OUTPUT_CSV: "signals_results.csv"
};

// ================= GLOBAL STATE =================
let ws = null;
let lastDigits = [];
let signals = [];
let signalResults = [];
let isConnected = false;
let tickCount = 0;
let totalSignals = 0;
let winCount = 0;
let lossCount = 0;
let pendingSignals = [];

// ================= DOM ELEMENTS =================
const elements = {
    status: document.getElementById('status'),
    signalStatus: document.getElementById('signalStatus'),
    tickCount: document.getElementById('tickCount'),
    connectBtn: document.getElementById('connectBtn'),
    stopBtn: document.getElementById('stopBtn'),
    exportBtn: document.getElementById('exportBtn'),
    resetBtn: document.getElementById('resetBtn'),
    signalsList: document.getElementById('signalsList'),
    resultsList: document.getElementById('resultsList'),
    totalSignalsCount: document.getElementById('totalSignalsCount'),
    winCount: document.getElementById('winCount'),
    lossCount: document.getElementById('lossCount'),
    winRate: document.getElementById('winRate'),
    currentTick: document.getElementById('currentTick'),
    lastDigit: document.getElementById('lastDigit'),
    digitHistory: document.getElementById('digitHistory'),
    signalsCount: document.getElementById('signalsCount'),
    resultsCount: document.getElementById('resultsCount'),
    signalAlert: document.getElementById('signalAlert'),
    alertMessage: document.getElementById('alertMessage')
};

// ================= UTILITY FUNCTIONS =================
function formatPrice(price) {
    return parseFloat(price).toFixed(2);
}

function getCurrentTime() {
    return new Date().toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(',', '');
}

// ================= SIGNAL ALERT =================
function showSignalAlert(message) {
    elements.alertMessage.textContent = message;
    elements.signalAlert.classList.add('show');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        closeSignalAlert();
    }, 5000);
}

function closeSignalAlert() {
    elements.signalAlert.classList.remove('show');
}

// ================= EMA FREQUENCY CALCULATION =================
function computeEmaFrequency(digits) {
    const emaFreq = {0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    
    digits.forEach(digit => {
        for (let d = 0; d < 10; d++) {
            emaFreq[d] = CONFIG.EMA_ALPHA * (digit === d ? 1 : 0) + 
                         (1 - CONFIG.EMA_ALPHA) * emaFreq[d];
        }
    });
    
    return emaFreq;
}

// ================= DANGER PATTERN DETECTION =================
function isDangerPattern(lastDigits, predictedDigit) {
    const last5 = lastDigits.slice(-5);
    let streak = 0;
    
    for (let i = last5.length - 1; i >= 0; i--) {
        if (last5[i] === predictedDigit) {
            streak++;
        } else {
            break;
        }
    }
    
    return streak >= 2;
}

// ================= CONFIRMATION FILTER =================
function confirmationFilter(emaFreq) {
    const sortedFreq = Object.entries(emaFreq)
        .sort((a, b) => a[1] - b[1]);
    
    const best = sortedFreq[0][1];
    const second = sortedFreq[1][1];
    
    return (second - best) >= 0.03;
}

// ================= SIGNAL RESULT TRACKING =================
function checkSignalResult(predictedDigit, signalTime) {
    const checkResult = (currentDigit) => {
        const isWin = currentDigit !== parseInt(predictedDigit);
        const result = isWin ? 'win' : 'loss';
        
        if (isWin) {
            winCount++;
        } else {
            lossCount++;
        }
        
        const resultData = {
            time: signalTime,
            predictedDigit: predictedDigit,
            actualDigit: currentDigit,
            result: result,
            checkTime: getCurrentTime()
        };
        
        signalResults.unshift(resultData);
        addResultMessage(resultData);
        updatePerformanceStats();
        
        const index = pendingSignals.findIndex(sig => sig.time === signalTime);
        if (index > -1) {
            pendingSignals.splice(index, 1);
        }
        
        updateSignalWithResult(signalTime, resultData);
    };
    
    pendingSignals.push({
        time: signalTime,
        predictedDigit: predictedDigit,
        checkResult: checkResult
    });
}

function updateSignalWithResult(signalTime, resultData) {
    const signalElements = elements.signalsList.querySelectorAll('.signal-item');
    signalElements.forEach(element => {
        const timeElement = element.querySelector('.signal-time');
        if (timeElement && timeElement.textContent === signalTime) {
            const detailsElement = element.querySelector('.signal-details');
            if (detailsElement) {
                const badge = resultData.result === 'win' ? 
                    '<span class="win-badge">WIN</span>' : 
                    '<span class="loss-badge">LOSS</span>';
                
                detailsElement.innerHTML = detailsElement.innerHTML.replace(
                    '</span>', 
                    `</span> ${badge} → Actual: ${resultData.actualDigit}`
                );
            }
        }
    });
}

// ================= SIGNAL PROCESSING =================
function processTick(price) {
    const priceStr = formatPrice(price);
    const currentDigit = parseInt(priceStr.replace('.', '').slice(-1));
    lastDigits.push(currentDigit);
    
    tickCount++;
    elements.tickCount.textContent = tickCount;
    elements.currentTick.textContent = priceStr;
    elements.lastDigit.textContent = `Last Digit: ${currentDigit}`;
    
    updateDigitHistory();
    
    if (pendingSignals.length > 0) {
        pendingSignals.forEach(signal => {
            signal.checkResult(currentDigit);
        });
    }
    
    if (lastDigits.length < CONFIG.WINDOW) {
        addSignalMessage(`Collecting digits... ${lastDigits.length}/${CONFIG.WINDOW}`, 'skipped');
        return;
    }

    const digitsWindow = lastDigits.slice(-CONFIG.WINDOW);
    
    const emaFreq = computeEmaFrequency(digitsWindow);
    const predictedDigit = Object.keys(emaFreq)
        .reduce((a, b) => emaFreq[a] < emaFreq[b] ? a : b);

    if (isDangerPattern(digitsWindow, parseInt(predictedDigit))) {
        addSignalMessage(`⚠️ Skipped - Danger pattern | Digit: ${predictedDigit}`, 'danger');
        return;
    }

    if (!confirmationFilter(emaFreq)) {
        addSignalMessage(`⏳ Weak signal - Skipped | Digit: ${predictedDigit}`, 'skipped');
        return;
    }

    totalSignals++;
    const signalTime = getCurrentTime();
    
    // Show signal alert
    showSignalAlert(`New signal detected! Predicted digit: ${predictedDigit}`);
    
    addSignalMessage(`🎯 SIGNAL FOUND → Digit: ${predictedDigit}`, 'good');
    updatePerformanceStats();
    
    checkSignalResult(predictedDigit, signalTime);
    
    elements.signalStatus.innerHTML = '<i class="fas fa-bolt"></i><span>Active Signal Detected!</span>';
    elements.signalStatus.className = 'signal-indicator active';
    
    setTimeout(() => {
        elements.signalStatus.innerHTML = '<i class="fas fa-pause-circle"></i><span>No Active Signals</span>';
        elements.signalStatus.className = 'signal-indicator idle';
    }, 3000);
}

// ================= UI UPDATE FUNCTIONS =================
function updateDigitHistory() {
    const recentDigits = lastDigits.slice(-10);
    elements.digitHistory.innerHTML = '';
    
    recentDigits.forEach((digit, index) => {
        const digitCircle = document.createElement('div');
        digitCircle.className = `digit-circle ${index === recentDigits.length - 1 ? 'recent' : ''}`;
        digitCircle.textContent = digit;
        elements.digitHistory.appendChild(digitCircle);
    });
}

function addSignalMessage(message, type) {
    const signalTime = getCurrentTime();
    const signalItem = document.createElement('div');
    signalItem.className = `signal-item signal-${type}`;
    
    const signalType = type === 'good' ? 'GOOD SIGNAL' : 
                      type === 'danger' ? 'DANGER' : 'SKIPPED';
    
    const typeClass = type === 'good' ? 'type-good' : 
                     type === 'danger' ? 'type-danger' : 'type-skipped';
    
    signalItem.innerHTML = `
        <div class="signal-header">
            <span class="signal-time">${signalTime}</span>
            <span class="signal-type ${typeClass}">${signalType}</span>
        </div>
        <div class="signal-details">${message}</div>
        <div class="signal-reason">
            ${type === 'good' ? 'All conditions met - Awaiting results...' : 
              type === 'danger' ? 'Danger pattern detected' : 
              'Confirmation filter failed'}
        </div>
    `;
    
    const emptyState = elements.signalsList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    elements.signalsList.insertBefore(signalItem, elements.signalsList.firstChild);
    
    const allSignals = elements.signalsList.querySelectorAll('.signal-item');
    if (allSignals.length > 15) {
        elements.signalsList.removeChild(allSignals[allSignals.length - 1]);
    }
    
    elements.signalsCount.textContent = allSignals.length;
    
    signals.push({
        time: signalTime,
        message: message,
        type: type
    });
}

function addResultMessage(resultData) {
    const resultItem = document.createElement('div');
    resultItem.className = `result-item result-${resultData.result}`;
    
    const resultType = resultData.result === 'win' ? 'WIN' : 'LOSS';
    const typeClass = resultData.result === 'win' ? 'type-win' : 'type-loss';
    const resultIcon = resultData.result === 'win' ? '✅' : '❌';
    
    resultItem.innerHTML = `
        <div class="result-header">
            <span class="result-time">${resultData.checkTime}</span>
            <span class="result-type ${typeClass}">${resultIcon} ${resultType}</span>
        </div>
        <div class="result-details">
            Signal: ≠ ${resultData.predictedDigit} | 
            Result: ${resultData.actualDigit}
        </div>
        <div class="result-info">
            ${resultData.result === 'win' ? 
              `Digit ${resultData.actualDigit} ≠ ${resultData.predictedDigit} - WIN!` : 
              `Digit ${resultData.actualDigit} = ${resultData.predictedDigit} - LOSS`}
        </div>
    `;
    
    const emptyState = elements.resultsList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    elements.resultsList.insertBefore(resultItem, elements.resultsList.firstChild);
    
    const allResults = elements.resultsList.querySelectorAll('.result-item');
    if (allResults.length > 12) {
        elements.resultsList.removeChild(allResults[allResults.length - 1]);
    }
    
    elements.resultsCount.textContent = allResults.length;
}

function updatePerformanceStats() {
    elements.totalSignalsCount.textContent = totalSignals;
    elements.winCount.textContent = winCount;
    elements.lossCount.textContent = lossCount;
    
    const totalCompleted = winCount + lossCount;
    const winRate = totalCompleted > 0 ? ((winCount / totalCompleted) * 100).toFixed(1) : 0;
    elements.winRate.textContent = `${winRate}%`;
}

function updateConnectionStatus(connected) {
    isConnected = connected;
    if (connected) {
        elements.status.innerHTML = '<i class="fas fa-circle"></i> Connected';
        elements.status.className = 'status-indicator connected';
    } else {
        elements.status.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
        elements.status.className = 'status-indicator disconnected';
    }
    elements.connectBtn.disabled = connected;
    elements.stopBtn.disabled = !connected;
}

// ================= WEBSOCKET MANAGEMENT =================
function startSignalMonitoring() {
    try {
        ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${CONFIG.APP_ID}`);
        
        ws.onopen = () => {
            console.log('Connected to Deriv');
            updateConnectionStatus(true);
            
            ws.send(JSON.stringify({ authorize: CONFIG.API_TOKEN }));
            
            setTimeout(() => {
                ws.send(JSON.stringify({ ticks: CONFIG.MARKET }));
                console.log('Subscribed to ticks...');
            }, 1000);
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.tick) {
                    const price = parseFloat(data.tick.quote);
                    processTick(price);
                } else if (data.error) {
                    console.error('Error:', data.error.message);
                    addSignalMessage(`Error: ${data.error.message}`, 'danger');
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            addSignalMessage('Connection error', 'danger');
            updateConnectionStatus(false);
        };
        
        ws.onclose = () => {
            console.log('Connection closed');
            updateConnectionStatus(false);
        };
        
    } catch (error) {
        console.error('Connection setup error:', error);
        addSignalMessage(`Setup error: ${error.message}`, 'danger');
        updateConnectionStatus(false);
    }
}

function stopSignalMonitoring() {
    if (ws) {
        ws.close();
        ws = null;
    }
    updateConnectionStatus(false);
    addSignalMessage('Signal monitoring stopped', 'skipped');
}

function resetStatistics() {
    totalSignals = 0;
    winCount = 0;
    lossCount = 0;
    pendingSignals = [];
    updatePerformanceStats();
    
    addSignalMessage('Statistics reset', 'skipped');
}

function exportToCSV() {
    if (signals.length === 0 && signalResults.length === 0) {
        alert('No data to export!');
        return;
    }
    
    const csvContent = [
        ['Time', 'Type', 'Message', 'Predicted Digit', 'Actual Digit', 'Result', 'Check Time'],
        ...signals.map(signal => [
            signal.time, 
            signal.type, 
            signal.message, 
            '', '', '', ''
        ]),
        ...signalResults.map(result => [
            result.time,
            'result',
            '',
            result.predictedDigit,
            result.actualDigit,
            result.result,
            result.checkTime
        ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = CONFIG.OUTPUT_CSV;
    a.click();
    window.URL.revokeObjectURL(url);
    
    addSignalMessage(`📊 CSV file downloaded: ${CONFIG.OUTPUT_CSV}`, 'good');
}

// ================= EVENT LISTENERS =================
elements.connectBtn.addEventListener('click', startSignalMonitoring);
elements.stopBtn.addEventListener('click', stopSignalMonitoring);
elements.exportBtn.addEventListener('click', exportToCSV);
elements.resetBtn.addEventListener('click', resetStatistics);

// Initialize
updateDigitHistory();

// Cleanup
window.addEventListener('beforeunload', () => {
    if (ws) {
        ws.close();
    }
});

console.log('Trading Signal Dashboard initialized!');