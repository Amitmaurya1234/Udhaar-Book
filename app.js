/* Udhaar Book: dependency-free offline-first MVP.
 * Money is stored as integer paise. The entity shape keeps sync-ready fields
 * even though this browser version has no server.
 */
const STORAGE_KEY = 'udhaarBookMvp_v1';
const DEVICE_KEY = 'udhaarBookDeviceId';
const MAX_AMOUNT_PAISE = 99999999999;
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const deviceId = localStorage.getItem(DEVICE_KEY) || (() => { const id = uid(); localStorage.setItem(DEVICE_KEY, id); return id; })();
const now = () => Date.now();
const clone = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const money = paise => `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(Number(paise || 0)) / 100)}`;
const compactMoney = paise => {
  return money(paise);
};
const dateObj = key => key ? new Date(`${key}T00:00:00`) : null;
const dateKey = value => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daysFromToday = key => {
  if (!key) return null;
  return Math.round((dateObj(key) - dateObj(todayKey())) / 86400000);
};
const localDateTime = value => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const dateLabel = key => {
  const diff = daysFromToday(key);
  if (diff === 0) return t('today');
  if (diff === -1) return t('yesterday');
  if (diff !== null && diff > 0 && diff <= 7) return `${t('in')} ${diff} ${t('days')}`;
  if (diff !== null && diff < 0 && diff >= -30) return `${Math.abs(diff)} ${t('daysAgo')}`;
  return new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(dateObj(key));
};
const currentLocale = () => state.settings.language === 'en' ? 'en-IN' : 'hi-IN';
const normalizePhone = input => {
  const digits = String(input || '').replace(/\D/g, '');
  const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(national) ? national : '';
};
const validPhoneInput = input => !String(input || '').trim() || Boolean(normalizePhone(input));
const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
const avatarColor = name => {
  let hash = 0; for (const ch of String(name || '')) hash = ((hash << 5) - hash) + ch.charCodeAt(0);
  return ['#00695c', '#7b1fa2', '#1565c0', '#ad1457', '#ef6c00', '#2e7d32'][Math.abs(hash) % 6];
};
const active = item => !item.deletedAt;
const baseEntity = () => ({ id: uid(), createdAt: now(), updatedAt: now(), deletedAt: null, version: 1, deviceId, syncStatus: 0 });
const defaultTemplates = {
  friendly: 'नमस्ते {name}, आपके खाते में {balance} बाकी है। जब सुविधा हो, कृपया भुगतान कर दें। {payment} — {shop}',
  due: 'नमस्ते {name}, {balance} का भुगतान आज बाकी है। कृपया आज भुगतान कर दें। {payment} — {shop}',
  firm: 'नमस्ते {name}, आपके खाते में {balance} काफी समय से बाकी है। कृपया भुगतान की तारीख बताएं। {payment} — {shop}',
  final: 'नमस्ते {name}, यह अंतिम विनम्र याद दिलाना है। {balance} का भुगतान कृपया तुरंत करें। {payment} — {shop}'
};
const defaults = () => ({
  settings: {
    language: 'hi', shopName: '', upiId: '', paymentNote: '', defaultCreditDays: 15,
    dailyReminderEnabled: true, dailyReminderTime: '09:00', templates: clone(defaultTemplates), onboardingDone: false,
    version: 1, deviceId
  }, parties: [], transactions: [], followUps: []
});
const loadState = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '');
    const base = defaults();
    return {
      settings: { ...base.settings, ...(parsed.settings || {}), templates: { ...base.settings.templates, ...((parsed.settings || {}).templates || {}) } },
      parties: Array.isArray(parsed.parties) ? parsed.parties : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      followUps: Array.isArray(parsed.followUps) ? parsed.followUps : []
    };
  } catch { return defaults(); }
};
let state = loadState();
const ui = { tab: 'parties', view: 'home', detailId: null, detailTab: 'transactions', search: '', filter: 'all', sort: 'recent', onboardingStep: 0, modal: null, openingDirection: 'receivable', reminderTone: 'friendly' };
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const t = key => {
  const strings = {
    hi: { appTag: 'हिसाब साफ़, वसूली आसान', parties: 'पार्टीज', settings: 'सेटिंग्स', youWillGet: 'आपको मिलना है', youWillGive: 'आपको देना है', settled: 'हिसाब बराबर', todayCollection: 'आज की वसूली', overdue: 'देर हो चुकी', search: 'पार्टी खोजें', all: 'सभी', owing: 'बकाया वाले', dueToday: 'आज', settledFilter: 'हिसाब बराबर', recent: 'हाल की गतिविधि', highest: 'सबसे ज़्यादा बकाया', oldest: 'सबसे पुराना बकाया', nameAz: 'नाम A–Z', addParty: '+ पार्टी जोड़ें', noParties: 'अभी कोई पार्टी नहीं', noPartiesText: 'पहली पार्टी जोड़ें और अपना उधार लिखना शुरू करें।', addFirst: 'पहली पार्टी जोड़ें', today: 'आज', yesterday: 'कल', in: 'अगले', days: 'दिन', daysAgo: 'दिन पहले', overdueDays: 'दिन देर', reminders: 'रिमाइंडर', reminder: 'रिमाइंडर', whatsapp: 'WhatsApp', call: 'कॉल', transactions: 'लेन-देन', followups: 'फॉलो-अप', gave: 'उधार दिया', got: 'पैसे मिले', give: 'YOU GAVE / उधार दिया', get: 'YOU GOT / पैसे मिले', promise: 'वादा तारीख', save: 'सेव करें', cancel: 'रद्द करें', edit: 'बदलें', delete: 'हटाएं', name: 'नाम', phone: 'फोन नंबर', creditLimit: 'क्रेडिट लिमिट', oldBalance: 'पहले से कितना बकाया है?', openingReceivable: 'मुझे मिलना है', openingPayable: 'मुझे देना है', note: 'नोट', date: 'तारीख', dueDate: 'वापसी की तारीख', addEntry: 'एंट्री जोड़ें', changeEntry: 'एंट्री बदलें', shopName: 'दुकान/आपका नाम', language: 'भाषा', backup: 'Backup & Restore', export: 'Backup डाउनलोड करें', import: 'Backup Restore करें', clear: 'सारा डेटा साफ़ करें', templates: 'रिमाइंडर संदेश', defaultDays: 'Default credit days', daily: 'सुबह का रिमाइंडर', payment: 'Payment details', upi: 'UPI ID', paymentNote: 'Payment note', about: 'About / Help', friendly: 'नरम', due: 'सामान्य', firm: 'सख्त', final: 'अंतिम', send: 'भेजें', log: 'लॉग करें', promiseSaved: 'वादा तारीख सेव हो गई', entrySaved: 'एंट्री सेव हो गई', partySaved: 'पार्टी सेव हो गई', reminderLogged: 'रिमाइंडर लॉग हो गया', noPhone: 'पहले फोन नंबर जोड़ें', selectDate: 'तारीख चुनें', backupDone: 'Backup डाउनलोड हो गया', restored: 'Backup restore हो गया', cleared: 'सारा डेटा साफ़ हो गया', verify: 'डेटा verify करें', next: 'आगे', skip: 'Skip', start: 'शुरू करें', languageTitle: 'अपनी भाषा चुनें', shopTitle: 'आपकी दुकान का नाम', noFollowups: 'अभी कोई follow-up नहीं', noTransactions: 'अभी कोई लेन-देन नहीं', dataLocal: 'आपका डेटा इस डिवाइस पर ही सेव है।', notification: 'सुबह का local reminder इस preference के अनुसार रहेगा।' },
    en: { appTag: 'Clear records, easier collection', parties: 'Parties', settings: 'Settings', youWillGet: 'You will get', youWillGive: 'You will give', settled: 'Settled', todayCollection: 'Today’s collection', overdue: 'Overdue', search: 'Search party', all: 'All', owing: 'Owing', dueToday: 'Today', settledFilter: 'Settled', recent: 'Recent activity', highest: 'Highest balance', oldest: 'Oldest balance', nameAz: 'Name A–Z', addParty: '+ Add party', noParties: 'No parties yet', noPartiesText: 'Add your first party and start recording credit.', addFirst: 'Add first party', today: 'Today', yesterday: 'Yesterday', in: 'In', days: 'days', daysAgo: 'days ago', overdueDays: 'days late', reminders: 'Reminders', reminder: 'Reminder', whatsapp: 'WhatsApp', call: 'Call', transactions: 'Transactions', followups: 'Follow-ups', gave: 'You gave', got: 'You got', give: 'YOU GAVE', get: 'YOU GOT', promise: 'Promise date', save: 'Save', cancel: 'Cancel', edit: 'Edit', delete: 'Delete', name: 'Name', phone: 'Phone number', creditLimit: 'Credit limit', oldBalance: 'Existing balance', openingReceivable: 'I will receive', openingPayable: 'I will give', note: 'Note', date: 'Date', dueDate: 'Due date', addEntry: 'Add entry', changeEntry: 'Edit entry', shopName: 'Shop/your name', language: 'Language', backup: 'Backup & Restore', export: 'Download backup', import: 'Restore backup', clear: 'Clear all data', templates: 'Reminder messages', defaultDays: 'Default credit days', daily: 'Morning reminder', payment: 'Payment details', upi: 'UPI ID', paymentNote: 'Payment note', about: 'About / Help', friendly: 'Friendly', due: 'Due', firm: 'Firm', final: 'Final', send: 'Send', log: 'Log', promiseSaved: 'Promise date saved', entrySaved: 'Entry saved', partySaved: 'Party saved', reminderLogged: 'Reminder logged', noPhone: 'Add a phone number first', selectDate: 'Choose date', backupDone: 'Backup downloaded', restored: 'Backup restored', cleared: 'All data cleared', verify: 'Verify data', next: 'Next', skip: 'Skip', start: 'Start', languageTitle: 'Choose your language', shopTitle: 'Your shop name', noFollowups: 'No follow-ups yet', noTransactions: 'No transactions yet', dataLocal: 'Your data is saved on this device.', notification: 'The morning local reminder follows this preference.' }
  };
  return (strings[state.settings.language] || strings.hi)[key] || key;
};
const html = value => value;
const partyById = id => state.parties.find(p => p.id === id && active(p));
const txnsFor = partyId => state.transactions.filter(tx => active(tx) && tx.partyId === partyId);
const followupsFor = partyId => state.followUps.filter(item => active(item) && item.partyId === partyId).sort((a, b) => b.createdAt - a.createdAt);
const balanceFor = partyId => txnsFor(partyId).reduce((sum, tx) => sum + (tx.type === 'gave' ? tx.amountPaise : -tx.amountPaise), 0);
const updatePartyBalance = party => { party.cachedBalancePaise = balanceFor(party.id); party.updatedAt = now(); party.version = (party.version || 1) + 1; party.syncStatus = 0; };
const allPartyInfo = party => {
  const txns = txnsFor(party.id).sort((a, b) => (a.txnDate || '').localeCompare(b.txnDate || '') || a.createdAt - b.createdAt);
  const balance = txns.reduce((sum, tx) => sum + (tx.type === 'gave' ? tx.amountPaise : -tx.amountPaise), 0);
  const queue = txns.filter(tx => tx.type === 'gave').map(tx => ({ date: tx.txnDate, amount: tx.amountPaise, dueDate: tx.dueDate || null }));
  let gotTotal = txns.filter(tx => tx.type === 'got').reduce((sum, tx) => sum + tx.amountPaise, 0);
  for (const item of queue) { const used = Math.min(item.amount, gotTotal); item.amount -= used; gotTotal -= used; if (gotTotal <= 0) break; }
  const outstanding = queue.filter(item => item.amount > 0);
  const oldest = balance > 0 && outstanding.length ? outstanding[0].date : null;
  const followupPromises = followupsFor(party.id).filter(item => item.kind === 'promise' && item.promiseDate).sort((a, b) => b.createdAt - a.createdAt);
  const latestPromise = followupPromises[0];
  let due = null;
  if (latestPromise && latestPromise.promiseDate && latestPromise.promiseDate >= dateKey(latestPromise.createdAt)) due = latestPromise.promiseDate;
  if (!due) { const dueDates = outstanding.map(item => item.dueDate).filter(Boolean).sort(); due = dueDates[0] || null; }
  if (!due && oldest) { const d = dateObj(oldest); d.setDate(d.getDate() + Number(state.settings.defaultCreditDays || 15)); due = dateKey(d); }
  const overdueDays = balance > 0 && due ? Math.max(0, -daysFromToday(due)) : 0;
  const dueIn = due ? daysFromToday(due) : null;
  const bucket = oldest ? (Math.abs(daysFromToday(oldest)) <= 7 ? '0–7' : Math.abs(daysFromToday(oldest)) <= 30 ? '8–30' : '31+') : null;
  const rating = overdueDays > 30 || (party.missedPromises || 0) >= 3 ? 'often' : overdueDays > 0 || (party.missedPromises || 0) >= 1 ? 'sometimes' : 'ontime';
  return { balance, oldest, due, overdueDays, dueIn, bucket, rating, txns };
};
const collectionStage = info => info.overdueDays > 30 ? 'final' : info.overdueDays > 7 ? 'firm' : info.overdueDays > 0 ? 'due' : 'friendly';
const renderRating = rating => ({ ontime: state.settings.language === 'hi' ? 'समय पर' : 'On time', sometimes: state.settings.language === 'hi' ? 'कभी-कभी देर' : 'Sometimes late', often: state.settings.language === 'hi' ? 'अक्सर देर' : 'Often late' }[rating] || '');
const renderBalance = amount => amount > 0 ? `<span class="balance receivable">${money(amount)}</span>` : amount < 0 ? `<span class="balance payable">−${money(amount)}</span>` : `<span class="balance settled">${t('settled')}</span>`;
const renderModal = () => {
  const root = document.getElementById('modal-root');
  if (!ui.modal) { root.innerHTML = ''; return; }
  let body = '';
  if (ui.modal.kind === 'party') body = partyFormHtml(ui.modal.id);
  if (ui.modal.kind === 'entry') body = entryFormHtml(ui.modal);
  if (ui.modal.kind === 'reminder') body = reminderFormHtml(ui.modal.id);
  if (ui.modal.kind === 'promise') body = promiseFormHtml(ui.modal.id);
  if (ui.modal.kind === 'confirm') body = `<div class="modal-head"><h2>${esc(ui.modal.title)}</h2><button class="icon-btn" data-action="close-modal">×</button></div><p>${esc(ui.modal.text)}</p><div class="modal-actions"><button class="outline-btn" data-action="close-modal">${t('cancel')}</button><button class="danger-btn" data-action="confirm-action">${esc(ui.modal.confirmText || t('delete'))}</button></div>`;
  root.innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true">${body}</section></div>`;
};
const openModal = modal => { ui.modal = modal; renderModal(); };
const closeModal = () => { ui.modal = null; renderModal(); };
const partyFormHtml = id => {
  const party = id ? partyById(id) : null;
  const editing = Boolean(party);
  return `<div class="modal-head"><h2>${editing ? t('edit') : t('addParty')}</h2><button class="icon-btn" data-action="close-modal">×</button></div>
    <form data-form="party" data-id="${id || ''}">
      <div class="field"><label>${t('name')} *</label><input name="name" maxlength="60" required value="${esc(party?.name || '')}" placeholder="जैसे: राजू किराना / Raju Kirana" /></div>
      <div class="field"><label>${t('phone')}</label><input name="phone" inputmode="tel" value="${esc(party?.phone || '')}" placeholder="+91 98765 43210" /><div class="party-meta" data-phone-error></div></div>
      <div class="field"><label>${t('creditLimit')}</label><input name="creditLimit" inputmode="decimal" value="${party?.creditLimitPaise ? (party.creditLimitPaise / 100).toFixed(2) : ''}" placeholder="Optional" /></div>
      ${editing ? '' : `<hr class="divider"><div class="field"><label>${t('oldBalance')}</label><input name="openingAmount" inputmode="decimal" placeholder="0.00" /><div class="radio-row"><div class="radio-card selected" data-opening-direction="receivable">${t('openingReceivable')}</div><div class="radio-card" data-opening-direction="payable">${t('openingPayable')}</div></div></div>`}
      <div class="field"><label>${t('note')}</label><textarea name="note" maxlength="500" placeholder="Optional">${esc(party?.note || '')}</textarea></div>
      <div class="modal-actions"><button type="button" class="outline-btn" data-action="close-modal">${t('cancel')}</button><button class="primary-btn" type="submit">${t('save')}</button></div>
    </form>`;
};
const entryFormHtml = modal => {
  const party = partyById(modal.partyId);
  const tx = modal.editingId ? state.transactions.find(item => item.id === modal.editingId) : null;
  const result = evaluateExpression(modal.expression || '');
  const typeName = modal.type === 'gave' ? t('gave') : t('got');
  return `<div class="modal-head"><h2>${modal.editingId ? t('changeEntry') : (modal.type === 'gave' ? t('give') : t('get'))}</h2><button class="icon-btn" data-action="close-modal">×</button></div>
    <div class="calculator">
      <div class="calc-type">${typeName}</div><div class="calc-party">${esc(party?.name || '')}</div>
      <div class="expression">${esc(normalizeExpression(modal.expression || '') || '0')}</div>
      <div class="calc-result">${result.ok ? money(result.paise) : '—'}</div>
      <div class="calc-grid">
        ${['7','8','9','÷','4','5','6','×','1','2','3','−','.','0','⌫','+'].map(key => `<button type="button" class="${['÷','×','−','+'].includes(key) ? 'operator' : ''}" data-calc="${key}">${key}</button>`).join('')}
        <button type="button" class="equals" data-calc="=">=</button>
      </div>
    </div>
    <form data-form="entry" data-party-id="${modal.partyId}" data-id="${modal.editingId || ''}">
      <div class="field"><label>${t('note')}</label><textarea name="note" maxlength="500" placeholder="Optional">${esc(tx?.note || '')}</textarea></div>
      <div class="form-grid"><div class="field"><label>${t('date')}</label><input type="date" name="txnDate" max="${todayKey()}" value="${esc(tx?.txnDate || todayKey())}" /></div><div class="field"><label>${t('dueDate')}</label><input type="date" name="dueDate" min="${todayKey()}" value="${esc(tx?.dueDate || '')}" ${modal.type === 'got' ? 'disabled' : ''} /></div></div><div class="field"><label>Bill / Photo</label><label class="attachment-btn">📷 ${tx?.photoPaths?.length ? 'Replace bill / photo' : 'Add bill / photo'}<input type="file" name="photo" accept="image/*" capture="environment" hidden /></label><div class="party-meta" data-photo-status>${tx?.photoPaths?.length ? `${tx.photoPaths.length} saved attachment(s)` : 'Take a photo or choose an image of the bill'}</div></div>
      ${modal.type === 'gave' ? `<div class="notice">${state.settings.language === 'hi' ? 'वापसी की तारीख न भरें तो default credit days इस्तेमाल होंगे।' : 'If no due date is set, default credit days will be used for ageing.'}</div>` : ''}
      <div class="modal-actions"><button type="button" class="outline-btn" data-action="close-modal">${t('cancel')}</button><button class="${modal.type === 'gave' ? 'danger-btn' : 'primary-btn'}" type="submit" ${!result.ok || result.paise <= 0 || result.paise > MAX_AMOUNT_PAISE ? 'disabled' : ''}>${t('save')}</button></div>
    </form>`;
};
const templateMessage = (party, tone) => {
  const info = allPartyInfo(party);
  const payment = state.settings.upiId ? `${state.settings.paymentNote ? `${state.settings.paymentNote} ` : ''}UPI: ${state.settings.upiId}` : state.settings.paymentNote;
  return (state.settings.templates[tone] || defaultTemplates[tone]).replaceAll('{name}', party.name).replaceAll('{balance}', money(info.balance)).replaceAll('{shop}', state.settings.shopName || 'Udhaar Book').replaceAll('{payment}', payment || '');
};
const reminderFormHtml = partyId => {
  const party = partyById(partyId); const info = allPartyInfo(party); const tone = ui.reminderTone;
  return `<div class="modal-head"><h2>${t('reminder')}</h2><button class="icon-btn" data-action="close-modal">×</button></div>
    <div class="detail-card" style="box-shadow:none; margin:0 0 12px; padding:14px"><strong>${esc(party.name)}</strong><div class="balance receivable" style="font-size:25px; margin-top:7px">${money(info.balance)}</div><div class="party-meta">${info.overdueDays ? `${info.overdueDays} ${t('overdueDays')}` : (info.due === todayKey() ? t('dueToday') : '')}</div></div>
    <div class="filter-strip">${['friendly','due','firm','final'].map(item => `<button type="button" class="filter-chip ${tone === item ? 'active' : ''}" data-reminder-tone="${item}">${t(item)}</button>`).join('')}</div>
    <div class="field"><label>${state.settings.language === 'hi' ? 'Message preview' : 'Message preview'}</label><textarea readonly style="min-height:130px">${esc(templateMessage(party, tone))}</textarea></div>
    <div class="modal-actions"><button class="outline-btn" data-action="log-reminder" data-channel="sms">SMS</button><button class="primary-btn" data-action="send-reminder" data-channel="whatsapp">${t('whatsapp')}</button></div>`;
};
const promiseFormHtml = partyId => {
  const party = partyById(partyId);
  return `<div class="modal-head"><h2>${t('promise')}</h2><button class="icon-btn" data-action="close-modal">×</button></div><form data-form="promise" data-party-id="${partyId}"><div class="field"><label>${esc(party.name)}</label><input type="date" name="promiseDate" min="${todayKey()}" required value="${todayKey()}" /></div><div class="field"><label>${t('note')}</label><textarea name="note" maxlength="500" placeholder="${state.settings.language === 'hi' ? 'जैसे: शनिवार शाम को देंगे' : 'e.g. Will pay Saturday evening'}"></textarea></div><div class="modal-actions"><button type="button" class="outline-btn" data-action="close-modal">${t('cancel')}</button><button class="primary-btn" type="submit">${t('save')}</button></div></form>`;
};
const renderOnboarding = () => {
  const step = ui.onboardingStep;
  const feature = step === 0 ? `<div class="onboarding-feature"><strong>${state.settings.language === 'hi' ? 'उधार लिखो, पैसे वापस लो' : 'Write credit, get money back'}</strong><span>${state.settings.language === 'hi' ? 'हर पार्टी का हिसाब कुछ सेकंड में लिखें और balance हमेशा साफ़ रखें।' : 'Record every party in seconds and keep the balance clear.'}</span></div>` : step === 1 ? `<div class="onboarding-feature"><strong>${state.settings.language === 'hi' ? 'रोज़ सुबह collection list' : 'Your morning collection list'}</strong><span>${state.settings.language === 'hi' ? 'आज किससे लेना है और कौन देर कर रहा है—एक नज़र में देखें।' : 'See who is due today and who is running late.'}</span></div>` : `<div class="onboarding-feature"><strong>${state.settings.language === 'hi' ? 'आपका हिसाब सुरक्षित' : 'Your records stay safe'}</strong><span>${state.settings.language === 'hi' ? 'यह version offline चलता है और आप JSON backup डाउनलोड कर सकते हैं।' : 'This version works offline and lets you download a JSON backup.'}</span></div>`;
  const controls = step === 1 ? `<div class="field"><label>${t('languageTitle')}</label><div class="radio-row"><div class="radio-card ${state.settings.language === 'hi' ? 'selected' : ''}" data-onboarding-language="hi">हिंदी</div><div class="radio-card ${state.settings.language === 'en' ? 'selected' : ''}" data-onboarding-language="en">English</div></div></div>` : step === 2 ? `<div class="field"><label>${t('shopTitle')}</label><input data-onboarding-shop name="shopName" maxlength="80" value="${esc(state.settings.shopName)}" placeholder="जैसे: शर्मा जनरल स्टोर" /></div>` : '';
  return `<main class="onboarding"><section class="onboarding-card card"><div class="brand-mark">उ</div><h1>Udhaar Book</h1><p class="lead">${t('appTag')}<br>${state.settings.language === 'hi' ? 'छोटी दुकान के लिए सरल digital उधार register.' : 'A simple digital credit register for small shops.'}</p><div class="onboarding-step">${[0,1,2].map(i => `<span class="step-dot ${i === step ? 'active' : ''}"></span>`).join('')}</div>${feature}${controls}<div class="onboarding-footer">${step === 0 ? `<button class="link-btn" data-action="skip-onboarding">${t('skip')}</button>` : `<button class="link-btn" data-action="onboarding-back">${state.settings.language === 'hi' ? 'पीछे' : 'Back'}</button>`}<button class="primary-btn" data-action="onboarding-next">${step === 2 ? t('start') : t('next')}</button></div></section></main>`;
};
const partyRow = party => {
  const info = allPartyInfo(party); const last = party.lastActivityAt ? dateLabel(dateKey(party.lastActivityAt)) : '';
  const overdue = info.overdueDays > 0 ? `<span class="overdue-tag">${info.overdueDays} ${t('overdueDays')}</span>` : '';
  return `<div class="party-row" data-action="open-detail" data-id="${party.id}"><div class="avatar" style="background:${avatarColor(party.name)}">${esc(initials(party.name))}</div><div class="party-main"><div class="party-name">${esc(party.name)}</div><div class="party-meta">${last || t('noTransactions')}${overdue}</div></div><div class="party-right">${renderBalance(info.balance)}${info.balance > 0 ? `<button class="remind-btn" data-action="open-reminder" data-id="${party.id}">${t('reminder')}</button>` : ''}</div><button class="icon-btn" style="min-width:34px; min-height:34px; font-size:21px" aria-label="More" data-action="party-menu" data-id="${party.id}">⋮</button></div>`;
};
const filteredParties = () => {
  let list = state.parties.filter(active);
  const query = ui.search.trim().toLocaleLowerCase();
  if (query) list = list.filter(p => p.name.toLocaleLowerCase().includes(query) || String(p.phone || '').includes(query.replace(/\D/g, '')));
  list = list.filter(p => { const info = allPartyInfo(p); if (ui.filter === 'owing') return info.balance > 0; if (ui.filter === 'overdue') return info.overdueDays > 0; if (ui.filter === 'today') return info.balance > 0 && info.due === todayKey(); if (ui.filter === 'settled') return info.balance === 0; return true; });
  return list.sort((a, b) => { const ia = allPartyInfo(a), ib = allPartyInfo(b); if (ui.sort === 'highest') return ib.balance - ia.balance; if (ui.sort === 'oldest') return String(ia.oldest || '9999').localeCompare(String(ib.oldest || '9999')); if (ui.sort === 'name') return a.name.localeCompare(b.name); return (b.lastActivityAt || b.createdAt) - (a.lastActivityAt || a.createdAt); });
};
const renderHome = () => {
  const parties = filteredParties(); const totals = state.parties.filter(active).reduce((acc, party) => { const b = allPartyInfo(party).balance; if (b > 0) acc.get += b; if (b < 0) acc.give += Math.abs(b); return acc; }, { get: 0, give: 0 });
  const todayCount = state.parties.filter(active).filter(p => { const i = allPartyInfo(p); return i.balance > 0 && i.due === todayKey(); }).length;
  const overdueCount = state.parties.filter(active).filter(p => allPartyInfo(p).overdueDays > 0).length;
  const todayTxns = state.transactions.filter(tx => active(tx) && tx.txnDate === todayKey()); const todayGot = todayTxns.filter(tx => tx.type === 'got').reduce((sum, tx) => sum + tx.amountPaise, 0); const todayGave = todayTxns.filter(tx => tx.type === 'gave').reduce((sum, tx) => sum + tx.amountPaise, 0);
  return `<main class="app-main khata-home"><div class="topbar"><div class="brand-lockup"><div class="brand-mark">उ</div><div><h1 class="brand-title">${esc(state.settings.shopName || 'Udhaar Book')}</h1><div class="brand-subtitle">${state.settings.language === 'hi' ? 'मेरा डिजिटल खाता⌄' : 'My digital ledger⌄'}</div></div></div><button class="icon-btn header-settings" data-action="open-settings" aria-label="Settings">⚙</button></div>
    <section class="summary-card card"><div class="summary-columns single-summary"><div><div class="eyebrow">${t('youWillGet')}</div><div class="summary-amount ${totals.get ? '' : 'positive-zero'}">${compactMoney(totals.get)}</div></div></div><div class="mini-recovery"><div><span>${state.settings.language === 'hi' ? 'आज मिला' : 'Received today'}</span><strong class="green">${money(todayGot)}</strong></div><div><span>${state.settings.language === 'hi' ? 'आज दिया' : 'Given today'}</span><strong class="red">${money(todayGave)}</strong></div></div><div class="summary-links"><button data-action="open-view" data-view="reports">▣ ${state.settings.language === 'hi' ? 'रिपोर्ट देखें' : 'View reports'}</button><button data-action="open-view" data-view="passbook">▤ ${state.settings.language === 'hi' ? 'पासबुक' : 'Passbook'}</button></div><div class="metric-row">${todayCount ? `<button class="metric-chip" data-action="collection-filter" data-filter="today">${t('todayCollection')} <strong>${todayCount}</strong></button>` : ''}${overdueCount ? `<button class="metric-chip" data-action="collection-filter" data-filter="overdue">${t('overdue')} <strong>${overdueCount}</strong></button>` : ''}</div></section>
    <div class="search-wrap"><span class="search-icon">⌕</span><input data-search placeholder="${t('search')}" value="${esc(ui.search)}" /></div>
    <div class="filter-strip">${[['all','all'],['owing','owing'],['overdue','overdue'],['today','dueToday'],['settled','settledFilter']].map(([key,label]) => `<button class="filter-chip ${ui.filter === key ? 'active' : ''}" data-filter="${key}">${t(label)}</button>`).join('')}</div>
    <div class="list-heading"><h2>${parties.length ? `${parties.length} ${state.settings.language === 'hi' ? 'पार्टी' : 'parties'}` : t('parties')}</h2><select class="sort-select" data-sort><option value="recent" ${ui.sort === 'recent' ? 'selected' : ''}>${t('recent')}</option><option value="highest" ${ui.sort === 'highest' ? 'selected' : ''}>${t('highest')}</option><option value="oldest" ${ui.sort === 'oldest' ? 'selected' : ''}>${t('oldest')}</option><option value="name" ${ui.sort === 'name' ? 'selected' : ''}>${t('nameAz')}</option></select></div>
    <section class="party-list">${parties.length ? parties.map(partyRow).join('') : `<div class="empty-state"><div class="empty-icon">₹</div><h3>${t('noParties')}</h3><p>${t('noPartiesText')}</p><button class="primary-btn" data-action="add-party">${t('addFirst')}</button></div>`}</section>
    <button class="fab" data-action="add-party">＋ ${t('addParty')}</button></main>${bottomNav('parties')}`;
};
const flatTransactions = () => state.transactions.filter(active).map(tx => ({ ...tx, party: partyById(tx.partyId) })).filter(tx => tx.party).sort((a, b) => (b.txnDate || '').localeCompare(a.txnDate || '') || b.createdAt - a.createdAt);
const renderReports = () => {
  const rows = flatTransactions(); const gave = rows.filter(tx => tx.type === 'gave').reduce((s, tx) => s + tx.amountPaise, 0); const got = rows.filter(tx => tx.type === 'got').reduce((s, tx) => s + tx.amountPaise, 0); const balance = gave - got;
  return `<main class="app-main"><div class="detail-header"><button class="icon-btn" data-action="back-home">‹</button><h1>${state.settings.language === 'hi' ? 'रिपोर्ट देखें' : 'View reports'}</h1></div><section class="report-hero card"><div><span>${state.settings.language === 'hi' ? 'कुल एंट्री' : 'Total entries'}</span><strong>${rows.length}</strong></div><div><span>${state.settings.language === 'hi' ? 'नेट बैलेंस' : 'Net balance'}</span><strong class="${balance >= 0 ? 'red' : 'green'}">${money(balance)}</strong></div></section><div class="report-filters"><button class="filter-chip active">${state.settings.language === 'hi' ? 'सभी' : 'All'}</button><button class="filter-chip" data-action="open-view" data-view="passbook">${state.settings.language === 'hi' ? 'पासबुक' : 'Passbook'}</button></div><section class="card report-card"><h2>${state.settings.language === 'hi' ? 'Customer report' : 'Customer report'}</h2><button class="report-link" data-action="open-view" data-view="passbook">▤ ${state.settings.language === 'hi' ? 'सभी customer transactions' : 'All customer transactions'} <span>›</span></button><button class="report-link" data-action="download-csv">⇩ ${state.settings.language === 'hi' ? 'Customer list CSV' : 'Customer list CSV'} <span>›</span></button></section><section class="card report-card"><h2>${state.settings.language === 'hi' ? 'सारांश' : 'Summary'}</h2><div class="report-line"><span>${t('youWillGive')}</span><strong class="green">${money(gave)}</strong></div><div class="report-line"><span>${t('youWillGet')}</span><strong class="red">${money(got)}</strong></div><div class="report-line"><span>${state.settings.language === 'hi' ? 'आज की एंट्री' : "Today's entries"}</span><strong>${rows.filter(tx => tx.txnDate === todayKey()).length}</strong></div></section></main>${bottomNav('parties')}`;
};
const renderPassbook = () => {
  const rows = flatTransactions(); const got = rows.filter(tx => tx.type === 'got').reduce((s, tx) => s + tx.amountPaise, 0); const gave = rows.filter(tx => tx.type === 'gave').reduce((s, tx) => s + tx.amountPaise, 0);
  return `<main class="app-main"><div class="detail-header"><button class="icon-btn" data-action="back-home">‹</button><h1>${state.settings.language === 'hi' ? 'पासबुक' : 'Passbook'}</h1><button class="icon-btn" data-action="open-view" data-view="reports">⌕</button></div><div class="updated-strip">${state.settings.language === 'hi' ? 'अभी अपडेट हुआ' : 'Updated just now'} <button data-action="refresh-view">↻ Refresh</button></div><section class="report-hero card"><div><span>${state.settings.language === 'hi' ? 'आपको मिला' : 'You received'}</span><strong class="green">${money(got)}</strong></div><div><span>${state.settings.language === 'hi' ? 'आपने दिया' : 'You paid'}</span><strong class="red">${money(gave)}</strong></div></section><section class="txn-list passbook-list">${rows.length ? rows.map(tx => `<div class="passbook-row" data-action="open-detail" data-id="${tx.party.id}"><div class="avatar" style="background:${avatarColor(tx.party.name)}">${esc(initials(tx.party.name))}</div><div class="party-main"><strong>${esc(tx.party.name)}</strong><div class="party-meta">${dateLabel(tx.txnDate)} · ${tx.note ? esc(tx.note) : (tx.type === 'gave' ? t('gave') : t('got'))}</div></div><strong class="${tx.type === 'gave' ? 'red' : 'green'}">${tx.type === 'gave' ? '−' : '+'}${money(tx.amountPaise)}</strong></div>`).join('') : `<div class="empty-state"><h3>${t('noTransactions')}</h3></div>`}</section></main>${bottomNav('parties')}`;
};
const renderCashbook = () => {
  const rows = flatTransactions(); const out = rows.filter(tx => tx.type === 'gave').reduce((s, tx) => s + tx.amountPaise, 0); const incoming = rows.filter(tx => tx.type === 'got').reduce((s, tx) => s + tx.amountPaise, 0);
  return `<main class="app-main"><div class="detail-header"><button class="icon-btn" data-action="back-home">‹</button><h1>${state.settings.language === 'hi' ? 'कैशबुक' : 'Cashbook'}</h1><button class="icon-btn">?</button></div><section class="cash-summary card"><div><strong>${money(incoming - out)}</strong><span>${state.settings.language === 'hi' ? 'कुल बैलेंस' : 'Total balance'}</span></div><div><strong class="red">${money(out)}</strong><span>${state.settings.language === 'hi' ? 'आज बाहर' : 'Out'}</span></div><div><strong class="green">${money(incoming)}</strong><span>${state.settings.language === 'hi' ? 'आज अंदर' : 'In'}</span></div></section><div class="cash-date">${dateLabel(todayKey())}</div><section class="txn-list">${rows.length ? rows.map(tx => `<div class="passbook-row"><div class="cash-dot ${tx.type}">${tx.type === 'gave' ? '−' : '+'}</div><div class="party-main"><strong>${esc(tx.party.name)}</strong><div class="party-meta">${dateLabel(tx.txnDate)} · ${tx.note || (tx.type === 'gave' ? t('gave') : t('got'))}</div></div><strong class="${tx.type === 'gave' ? 'red' : 'green'}">${tx.type === 'gave' ? '−' : '+'}${money(tx.amountPaise)}</strong></div>`).join('') : `<div class="empty-state"><div class="empty-icon">₹</div><h3>${state.settings.language === 'hi' ? 'कैशबुक खाली है' : 'Cashbook is empty'}</h3><p>${state.settings.language === 'hi' ? 'पहली पार्टी entry से cash flow यहां दिखेगा।' : 'Your party entries will appear here.'}</p></div>`}</section><div class="sticky-entry"><button class="entry-gave" data-action="add-party">− ${state.settings.language === 'hi' ? 'OUT एंट्री' : 'OUT entry'}</button><button class="entry-got" data-action="add-party">＋ ${state.settings.language === 'hi' ? 'IN एंट्री' : 'IN entry'}</button></div></main>${bottomNav('cashbook')}`;
};
const renderMore = () => `<main class="app-main"><div class="topbar"><div><div class="eyebrow">Udhaar Book</div><h1 class="brand-title">${state.settings.language === 'hi' ? 'और फीचर्स' : 'More'}</h1></div></div><section class="more-grid"><button class="more-tile" data-action="open-view" data-view="reports">▣<span>${state.settings.language === 'hi' ? 'रिपोर्ट' : 'Reports'}</span></button><button class="more-tile" data-action="open-view" data-view="passbook">▤<span>${state.settings.language === 'hi' ? 'पासबुक' : 'Passbook'}</span></button><button class="more-tile" data-action="open-view" data-view="cashbook">₹<span>${state.settings.language === 'hi' ? 'कैशबुक' : 'Cashbook'}</span></button><button class="more-tile" data-action="open-settings">⚙<span>${t('settings')}</span></button></section><section class="settings-list"><div class="setting-card card"><h3>${state.settings.language === 'hi' ? 'Udhaar Book मदद' : 'Udhaar Book help'}</h3><p>${state.settings.language === 'hi' ? 'ग्राहक जोड़ें, उधार दिया या पैसे मिले दर्ज करें, फिर पासबुक और रिपोर्ट में पूरा हिसाब देखें।' : 'Add a party, record money given or received, then use Passbook and Reports for the complete picture.'}</p></div></section></main>${bottomNav('more')}`;
const renderDetail = () => {
  const party = partyById(ui.detailId); if (!party) { ui.view = 'home'; return renderHome(); }
  const info = allPartyInfo(party); const followups = followupsFor(party.id); const limitWarn = party.creditLimitPaise && info.balance > party.creditLimitPaise ? `<div class="notice">${state.settings.language === 'hi' ? 'क्रेडिट लिमिट पार हो गई' : 'Credit limit exceeded'} · ${money(party.creditLimitPaise)}</div>` : '';
  const txns = info.txns.slice().reverse(); let running = 0; const runningMap = new Map(); info.txns.forEach(tx => { running += tx.type === 'gave' ? tx.amountPaise : -tx.amountPaise; runningMap.set(tx.id, running); });
  const content = ui.detailTab === 'transactions' ? (txns.length ? `<div class="txn-list">${txns.map(tx => `<div class="txn-card" data-action="edit-entry" data-id="${tx.id}"><div class="txn-top"><span class="txn-type ${tx.type}">${tx.type === 'gave' ? t('gave') : t('got')}</span><span class="txn-amount ${tx.type === 'gave' ? 'balance receivable' : 'balance payable'}">${tx.type === 'gave' ? '' : '+'}${money(tx.amountPaise)}</span></div><div class="txn-details">${localDateTime(tx.createdAt)}${tx.breakdown ? `<br><strong>${esc(tx.breakdown)}</strong>` : ''}${tx.note ? `<br>${esc(tx.note)}` : ''}${tx.dueDate ? `<br>${t('dueDate')}: ${dateLabel(tx.dueDate)}` : ''}</div><div class="running">${state.settings.language === 'hi' ? 'इस एंट्री के बाद balance' : 'Balance after entry'}: ${runningMap.get(tx.id) > 0 ? money(runningMap.get(tx.id)) : runningMap.get(tx.id) < 0 ? `−${money(runningMap.get(tx.id))}` : t('settled')}</div></div>`).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">+</div><h3>${t('noTransactions')}</h3><p>${state.settings.language === 'hi' ? 'नीचे से उधार दिया या पैसे मिले दर्ज करें।' : 'Use the buttons below to record money given or received.'}</p></div>`) : (followups.length ? `<div class="follow-list">${followups.map(item => `<div class="follow-card"><div class="follow-top"><strong>${item.kind === 'promise' ? t('promise') : item.kind === 'call' ? t('call') : t('reminder')}</strong><span class="party-meta">${localDateTime(item.createdAt)}</span></div><div class="txn-details">${esc(item.note || (item.kind === 'promise' ? dateLabel(item.promiseDate) : ''))}</div></div>`).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">✓</div><h3>${t('noFollowups')}</h3><p>${state.settings.language === 'hi' ? 'रिमाइंडर, कॉल या promise यहां दिखेंगे।' : 'Reminders, calls and promises will appear here.'}</p></div>`);
  return `<main class="app-main"><div class="detail-header"><button class="icon-btn" data-action="back-home">‹</button><h1>${esc(party.name)}</h1><button class="icon-btn" data-action="party-menu" data-id="${party.id}">⋮</button></div><section class="detail-card card"><div class="party-meta">${party.phone ? `${esc(party.phone)} · ` : ''}<span class="tag">${renderRating(info.rating)}</span></div><div class="detail-balance ${info.balance > 0 ? 'balance receivable' : info.balance < 0 ? 'balance payable' : 'balance settled'}">${info.balance > 0 ? money(info.balance) : info.balance < 0 ? `−${money(info.balance)}` : t('settled')}</div><div class="eyebrow">${info.balance > 0 ? t('youWillGet') : info.balance < 0 ? t('youWillGive') : t('settled')}</div>${info.due ? `<div class="party-meta" style="margin-top:12px">${t('promise')}: <strong>${dateLabel(info.due)}</strong></div>` : `<button class="link-btn" style="padding:0; margin-top:12px" data-action="open-promise">+ ${t('promise')}</button>`}${limitWarn}<div class="detail-actions" style="margin-top:15px"><button class="action-btn reminder" data-action="open-reminder" data-id="${party.id}" ${info.balance <= 0 ? 'disabled' : ''}>${t('reminder')}</button><button class="action-btn whatsapp" data-action="quick-whatsapp" data-id="${party.id}" ${party.phone ? '' : 'disabled'}>${t('whatsapp')}</button><button class="action-btn call" data-action="quick-call" data-id="${party.id}" ${party.phone ? '' : 'disabled'}>${t('call')}</button></div>${!party.phone ? `<div class="party-meta" style="margin-top:10px">${t('noPhone')}</div>` : ''}</section><div class="segmented"><button class="${ui.detailTab === 'transactions' ? 'active' : ''}" data-detail-tab="transactions">${t('transactions')}</button><button class="${ui.detailTab === 'followups' ? 'active' : ''}" data-detail-tab="followups">${t('followups')}</button></div>${content}<div class="sticky-entry"><button class="entry-gave" data-action="add-entry" data-type="gave">${t('give')}</button><button class="entry-got" data-action="add-entry" data-type="got">${t('get')}</button></div></main>`;
};
const settingInput = (label, name, value, type = 'text', extra = '') => `<div class="field"><label>${label}</label><input type="${type}" name="${name}" value="${esc(value)}" ${extra} /></div>`;
const renderSettings = () => `<main class="app-main"><div class="topbar"><div><div class="eyebrow">Udhaar Book</div><h1 class="brand-title">${t('settings')}</h1></div></div><section class="settings-list">
  <div class="setting-card card"><h3>${t('language')}</h3><p>${state.settings.language === 'hi' ? 'भाषा तुरंत बदलें।' : 'Switch language instantly.'}</p><div class="radio-row"><div class="radio-card ${state.settings.language === 'hi' ? 'selected' : ''}" data-setting-language="hi">हिंदी</div><div class="radio-card ${state.settings.language === 'en' ? 'selected' : ''}" data-setting-language="en">English</div></div></div>
  <form class="setting-card card" data-form="settings-main"><h3>${t('shopName')}</h3><p>${state.settings.language === 'hi' ? 'Reminder messages में इस्तेमाल होगा।' : 'Used in reminder messages.'}</p>${settingInput(t('shopName'), 'shopName', state.settings.shopName)}${settingInput(t('upi'), 'upiId', state.settings.upiId, 'text', 'placeholder="name@upi"')}${settingInput(t('paymentNote'), 'paymentNote', state.settings.paymentNote)}${settingInput(t('defaultDays'), 'defaultCreditDays', state.settings.defaultCreditDays, 'number', 'min="1" max="180"')}<button class="primary-btn" type="submit">${t('save')}</button></form>
  <div class="setting-card card"><h3>${t('daily')}</h3><p>${t('notification')}</p><div class="setting-row"><span>${state.settings.dailyReminderEnabled ? (state.settings.language === 'hi' ? 'चालू' : 'On') : (state.settings.language === 'hi' ? 'बंद' : 'Off')}</span><button class="switch ${state.settings.dailyReminderEnabled ? 'on' : ''}" data-action="toggle-daily"><span></span></button></div></div>
  <form class="setting-card card" data-form="templates"><h3>${t('templates')}</h3><p>{name}, {balance}, {shop}, {payment} placeholders supported.</p>${['friendly','due','firm','final'].map(key => `<div class="field"><label>${t(key)}</label><textarea name="${key}" maxlength="500">${esc(state.settings.templates[key])}</textarea></div>`).join('')}<button class="primary-btn" type="submit">${t('save')}</button></form>
  <div class="setting-card card"><h3>${t('backup')}</h3><p>${t('dataLocal')}</p><div class="modal-actions"><button class="outline-btn" data-action="download-backup">${t('export')}</button><button class="secondary-btn" data-action="restore-backup">${t('import')}</button></div><input type="file" id="restore-file" accept="application/json" hidden /></div>
  <div class="setting-card card"><h3>${t('about')}</h3><p>Udhaar Book MVP · offline-first collection register.<br>${state.settings.language === 'hi' ? 'डेटा verify और backup नियमित करें।' : 'Verify data and create backups regularly.'}</p><button class="outline-btn" data-action="verify-data">${t('verify')}</button></div>
  <div class="setting-card card"><h3>${t('clear')}</h3><p>${state.settings.language === 'hi' ? 'यह सभी local records हटा देगा। Backup पहले डाउनलोड करें।' : 'This removes all local records. Download a backup first.'}</p><button class="danger-btn" data-action="clear-data">${t('clear')}</button></div>
</section></main>${bottomNav('settings')}`;
const bottomNav = activeTab => `<nav class="bottom-nav"><div class="bottom-nav-inner"><button class="nav-btn ${activeTab === 'parties' ? 'active' : ''}" data-nav="parties"><span class="nav-icon">♙</span>${t('parties')}</button><button class="nav-btn ${activeTab === 'settings' || activeTab === 'more' ? 'active' : ''}" data-nav="settings"><span class="nav-icon">⚙</span>${t('settings')}</button></div></nav>`;
const render = () => {
  const app = document.getElementById('app');
  if (!state.settings.onboardingDone) { app.innerHTML = renderOnboarding(); renderModal(); return; }
  if (ui.view === 'detail') app.innerHTML = renderDetail(); else if (ui.view === 'reports') app.innerHTML = renderReports(); else if (ui.view === 'passbook') app.innerHTML = renderPassbook(); else if (ui.view === 'cashbook') app.innerHTML = renderCashbook(); else if (ui.view === 'more') app.innerHTML = renderMore(); else if (ui.tab === 'settings') app.innerHTML = renderSettings(); else app.innerHTML = renderHome();
  renderModal();
};
const toast = message => { const root = document.getElementById('toast-root'); const item = document.createElement('div'); item.textContent = message; item.style.cssText = 'position:fixed;left:50%;bottom:95px;transform:translateX(-50%);z-index:50;background:#102d29;color:#fff;padding:12px 16px;border-radius:12px;font-weight:800;box-shadow:0 8px 22px rgba(0,0,0,.2);max-width:calc(100% - 32px);text-align:center'; root.appendChild(item); setTimeout(() => item.remove(), 2700); };
const mutateParty = (party, changes) => { Object.assign(party, changes, { updatedAt: now(), version: (party.version || 1) + 1, syncStatus: 0 }); save(); };
const parsePaise = input => { const text = String(input || '').replace(/,/g, '').trim(); if (!/^\d+(\.\d{1,2})?$/.test(text)) return null; const [whole, decimals = ''] = text.split('.'); const result = Number(whole) * 100 + Number((decimals + '00').slice(0, 2)); return Number.isSafeInteger(result) ? result : null; };
const tokenize = expression => {
  const source = String(expression || '').replace(/\s+/g, '').replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  if (!source) return [];
  const tokens = []; let number = '';
  for (const char of source) {
    if (/\d|\./.test(char)) { number += char; continue; }
    if ('+-*/'.includes(char)) { if (!number) { if (char === '-' && tokens.length === 0) return null; return null; } tokens.push(number); tokens.push(char); number = ''; continue; }
    return null;
  }
  if (number) tokens.push(number); else if (tokens.length && '+-*/'.includes(tokens[tokens.length - 1])) return null;
  if (tokens.some((token, index) => index % 2 === 0 ? !/^\d+(\.\d+)?$/.test(token) || (token.match(/\./g) || []).length > 1 : !'+-*/'.includes(token))) return null;
  return tokens;
};
const fractionFromDecimal = value => { const [whole, decimals = ''] = String(value).split('.'); const scale = 10n ** BigInt(decimals.length); return { n: BigInt(whole) * scale + BigInt(decimals || 0), d: scale }; };
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; };
const reduce = f => { const g = gcd(f.n, f.d); return { n: f.n / g, d: f.d / g }; };
const calcOp = (a, op, b) => { if (op === '+') return reduce({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }); if (op === '-') return reduce({ n: a.n * b.d - b.n * a.d, d: a.d * b.d }); if (op === '*') return reduce({ n: a.n * b.n, d: a.d * b.d }); if (b.n === 0n) return null; return reduce({ n: a.n * b.d, d: a.d * b.n }); };
const evaluateExpression = expression => {
  const tokens = tokenize(expression); if (!tokens || !tokens.length) return { ok: false, reason: 'empty' };
  const values = []; const operators = []; const precedence = op => op === '*' || op === '/' ? 2 : 1;
  const apply = () => { const op = operators.pop(); const b = values.pop(); const a = values.pop(); if (!a || !b) return false; const result = calcOp(a, op, b); if (!result) return false; values.push(result); return true; };
  for (let i = 0; i < tokens.length; i += 1) { if (i % 2 === 0) values.push(fractionFromDecimal(tokens[i])); else { const op = tokens[i]; while (operators.length && precedence(operators[operators.length - 1]) >= precedence(op)) if (!apply()) return { ok: false, reason: 'invalid' }; operators.push(op); } }
  while (operators.length) if (!apply()) return { ok: false, reason: 'invalid' };
  const result = values[0]; if (!result || result.n <= 0n) return { ok: true, paise: Number(result?.n || 0n), invalidAmount: true };
  const scaled = result.n * 100n; const quotient = scaled / result.d; const remainder = scaled % result.d; const rounded = quotient + (remainder * 2n >= result.d ? 1n : 0n); const paise = Number(rounded);
  return Number.isSafeInteger(paise) ? { ok: true, paise, normalized: normalizeExpression(expression) } : { ok: false, reason: 'too-large' };
};
const normalizeExpression = expression => String(expression || '').replace(/\s+/g, '').replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−').replace(/([+−×÷])/g, ' $1 ').replace(/\s+/g, ' ').trim();
const appendCalc = key => {
  const entry = ui.modal; let expression = entry.expression || '';
  if (key === 'C') expression = '';
  else if (key === '⌫') expression = expression.slice(0, -1);
  else if (key === '=') entry.finalized = true;
  else if ('+−×÷'.includes(key)) { if (!expression) return; if ('+−×÷'.includes(expression.slice(-1))) expression = expression.slice(0, -1); expression += key; entry.finalized = false; }
  else if (key === '.') { const current = expression.split(/[+−×÷]/).pop() || ''; if (!current.includes('.')) expression += current ? '.' : '0.'; entry.finalized = false; }
  else { if (entry.finalized && /^\d$/.test(key)) expression = ''; expression += key; entry.finalized = false; }
  entry.expression = expression; renderModal();
};
const addFollowup = data => { state.followUps.push({ ...baseEntity(), ...data, balanceAtTimePaise: balanceFor(data.partyId) }); save(); };
const logReminder = (partyId, channel, openExternal = false) => { const party = partyById(partyId); if (!party) return; const tone = ui.reminderTone; const message = templateMessage(party, tone); addFollowup({ partyId, kind: channel === 'sms' ? 'reminder_sms' : 'reminder_whatsapp', tone, note: message }); if (openExternal && party.phone) { const encoded = encodeURIComponent(message); if (channel === 'sms') window.open(`sms:${party.phone}?body=${encoded}`, '_blank'); else window.open(`https://wa.me/91${party.phone}?text=${encoded}`, '_blank'); } closeModal(); toast(t('reminderLogged')); };
const downloadBackup = () => { const payload = { app: 'Udhaar Book', version: 1, exportedAt: new Date().toISOString(), data: state }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `udhaar-book-backup-${todayKey()}.json`; link.click(); URL.revokeObjectURL(link.href); toast(t('backupDone')); };
const verifyData = () => { const issues = []; state.parties.filter(active).forEach(party => { const computed = balanceFor(party.id); if (computed !== Number(party.cachedBalancePaise || 0)) issues.push(party.name); }); if (issues.length) { state.parties.filter(active).forEach(updatePartyBalance); save(); toast(`${issues.length} ${state.settings.language === 'hi' ? 'balance ठीक किए गए' : 'balances repaired'}`); } else toast(state.settings.language === 'hi' ? 'डेटा सही है' : 'Data looks good'); };
const handleClick = event => {
  const target = event.target.closest('[data-action],[data-nav],[data-filter],[data-detail-tab],[data-calc],[data-opening-direction],[data-reminder-tone],[data-onboarding-language],[data-setting-language]'); if (!target) return;
  const action = target.dataset.action;
  if (target.dataset.nav) { ui.tab = target.dataset.nav; ui.view = target.dataset.nav === 'cashbook' ? 'cashbook' : target.dataset.nav === 'more' ? 'more' : 'home'; render(); return; }
  if (target.dataset.filter) { ui.filter = target.dataset.filter; render(); return; }
  if (target.dataset.detailTab) { ui.detailTab = target.dataset.detailTab; render(); return; }
  if (target.dataset.calc) { appendCalc(target.dataset.calc); return; }
  if (target.dataset.openingDirection) { ui.openingDirection = target.dataset.openingDirection; document.querySelectorAll('[data-opening-direction]').forEach(el => el.classList.toggle('selected', el.dataset.openingDirection === ui.openingDirection)); return; }
  if (target.dataset.reminderTone) { ui.reminderTone = target.dataset.reminderTone; renderModal(); return; }
  if (target.dataset.onboardingLanguage) { state.settings.language = target.dataset.onboardingLanguage; render(); return; }
  if (target.dataset.settingLanguage) { state.settings.language = target.dataset.settingLanguage; save(); render(); toast(state.settings.language === 'hi' ? 'भाषा बदल गई' : 'Language updated'); return; }
  if (action === 'open-view') { ui.view = target.dataset.view; ui.tab = target.dataset.view === 'cashbook' ? 'cashbook' : target.dataset.view === 'more' ? 'more' : 'parties'; render(); return; }
  if (action === 'collection-filter') { ui.filter = target.dataset.filter || 'today'; ui.view = 'home'; render(); return; }
  if (action === 'refresh-view') { render(); toast(state.settings.language === 'hi' ? 'पासबुक अपडेट हो गई' : 'Passbook refreshed'); return; }
  if (action === 'supplier-info') { toast(state.settings.language === 'hi' ? 'Supplier ledger अगले update में उपलब्ध होगा' : 'Supplier ledger is planned for the next update'); return; }
  if (action === 'download-csv') { const rows = flatTransactions(); const csv = [['Date','Party','Type','Amount','Note'], ...rows.map(tx => [tx.txnDate, tx.party.name, tx.type, (tx.amountPaise / 100).toFixed(2), tx.note || ''])].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `udhaar-book-report-${todayKey()}.csv`; link.click(); URL.revokeObjectURL(link.href); toast(state.settings.language === 'hi' ? 'रिपोर्ट डाउनलोड हो गई' : 'Report downloaded'); return; }
  if (action === 'backdrop-close' && event.target === target) { closeModal(); return; }
  if (action === 'close-modal') { closeModal(); return; }
  if (action === 'onboarding-next') { if (ui.onboardingStep < 2) ui.onboardingStep += 1; else { const input = document.querySelector('[data-onboarding-shop]'); if (input) state.settings.shopName = input.value.trim(); state.settings.onboardingDone = true; save(); } render(); return; }
  if (action === 'onboarding-back') { ui.onboardingStep = Math.max(0, ui.onboardingStep - 1); render(); return; }
  if (action === 'skip-onboarding') { state.settings.onboardingDone = true; save(); render(); return; }
  if (action === 'open-settings') { ui.tab = 'settings'; ui.view = 'home'; render(); return; }
  if (action === 'add-party' || action === 'edit-party') { openModal({ kind: 'party', id: target.dataset.id || null }); return; }
  if (action === 'open-detail') { ui.detailId = target.dataset.id; ui.view = 'detail'; ui.detailTab = 'transactions'; render(); return; }
  if (action === 'back-home') { ui.view = 'home'; ui.tab = 'parties'; render(); return; }
  if (action === 'party-menu') { const party = partyById(target.dataset.id); if (!party) return; openModal({ kind: 'confirm', title: party.name, text: state.settings.language === 'hi' ? 'क्या करना है?' : 'What would you like to do?', confirmText: t('delete'), partyMenu: true, partyId: party.id }); return; }
  if (action === 'open-reminder') { ui.reminderTone = collectionStage(allPartyInfo(partyById(target.dataset.id))); openModal({ kind: 'reminder', id: target.dataset.id }); return; }
  if (action === 'quick-whatsapp') { const party = partyById(target.dataset.id); if (party?.phone) window.open(`https://wa.me/91${party.phone}`, '_blank'); else toast(t('noPhone')); return; }
  if (action === 'quick-call') { const party = partyById(target.dataset.id); if (party?.phone) window.location.href = `tel:${party.phone}`; else toast(t('noPhone')); return; }
  if (action === 'add-entry') { ui.modal = { kind: 'entry', partyId: ui.detailId, type: target.dataset.type, expression: '' }; renderModal(); return; }
  if (action === 'edit-entry') { const tx = state.transactions.find(item => item.id === target.dataset.id); if (tx) { ui.modal = { kind: 'entry', partyId: tx.partyId, type: tx.type, editingId: tx.id, expression: tx.breakdown || String((tx.amountPaise / 100).toFixed(2)).replace(/\.00$/, '') }; renderModal(); } return; }
  if (action === 'open-promise') { openModal({ kind: 'promise', id: ui.detailId }); return; }
  if (action === 'send-reminder') { logReminder(ui.modal.id, 'whatsapp', true); return; }
  if (action === 'log-reminder') { logReminder(ui.modal.id, target.dataset.channel || 'sms', true); return; }
  if (action === 'confirm-action') { if (ui.modal.partyMenu) { const id = ui.modal.partyId; const party = partyById(id); const option = window.prompt(state.settings.language === 'hi' ? '1 = Edit, 2 = Delete' : '1 = Edit, 2 = Delete', '1'); if (option === '1') { closeModal(); openModal({ kind: 'party', id }); } else if (option === '2' && window.confirm(`${t('delete')}: ${party?.name}?`)) { const stamp = now(); state.parties.filter(p => p.id === id).forEach(p => { p.deletedAt = stamp; p.updatedAt = stamp; p.version = (p.version || 1) + 1; }); state.transactions.filter(tx => tx.partyId === id).forEach(tx => tx.deletedAt = stamp); state.followUps.filter(f => f.partyId === id).forEach(f => f.deletedAt = stamp); save(); closeModal(); ui.view = 'home'; render(); toast(state.settings.language === 'hi' ? 'पार्टी हटा दी गई' : 'Party deleted'); } else closeModal(); } return; }
  if (action === 'toggle-daily') { state.settings.dailyReminderEnabled = !state.settings.dailyReminderEnabled; save(); render(); return; }
  if (action === 'download-backup') { downloadBackup(); return; }
  if (action === 'restore-backup') { document.getElementById('restore-file')?.click(); return; }
  if (action === 'verify-data') { verifyData(); return; }
  if (action === 'clear-data') { if (window.confirm(state.settings.language === 'hi' ? 'सारा local data हटाएं? यह undo नहीं होगा।' : 'Clear all local data? This cannot be undone.')) { const lang = state.settings.language; state = defaults(); state.settings.language = lang; save(); render(); toast(t('cleared')); } return; }
};
const handleInput = event => {
  if (event.target.matches('[data-search]')) { ui.search = event.target.value; const caret = event.target.selectionStart; render(); const input = document.querySelector('[data-search]'); if (input) { input.focus(); input.setSelectionRange(caret, caret); } }
  if (event.target.name === 'phone' && ui.modal?.kind === 'party') { const error = event.target.parentElement.querySelector('[data-phone-error]'); if (error) error.textContent = validPhoneInput(event.target.value) ? '' : (state.settings.language === 'hi' ? 'सही 10-digit phone number डालें' : 'Enter a valid 10-digit phone number'); }
};
const handleChange = event => { if (event.target.matches('[data-sort]')) { ui.sort = event.target.value; render(); } if (event.target.name === 'photo' && ui.modal?.kind === 'entry' && event.target.files?.[0]) { const reader = new FileReader(); reader.onload = () => { ui.modal.pendingPhoto = reader.result; const status = event.target.closest('.field')?.querySelector('[data-photo-status]'); if (status) status.textContent = 'Photo selected — save entry to attach it'; }; reader.readAsDataURL(event.target.files[0]); } };
const handleSubmit = event => {
  const form = event.target; if (!form.dataset.form) return; event.preventDefault(); const data = new FormData(form);
  if (form.dataset.form === 'party') {
    const name = String(data.get('name') || '').trim(); const phoneInput = String(data.get('phone') || '').trim(); if (!name) return toast(state.settings.language === 'hi' ? 'नाम जरूरी है' : 'Name is required'); if (!validPhoneInput(phoneInput)) return toast(state.settings.language === 'hi' ? 'Phone number सही नहीं है' : 'Phone number is invalid'); const phone = normalizePhone(phoneInput); const creditLimitPaise = data.get('creditLimit') ? parsePaise(data.get('creditLimit')) : null; if (data.get('creditLimit') && creditLimitPaise === null) return toast(state.settings.language === 'hi' ? 'Credit limit सही amount में डालें' : 'Enter a valid credit limit');
    if (form.dataset.id) { const party = partyById(form.dataset.id); mutateParty(party, { name, phone, creditLimitPaise, note: String(data.get('note') || '').trim() }); ui.detailId = party.id; closeModal(); ui.view = 'detail'; render(); toast(t('partySaved')); } else { const party = { ...baseEntity(), name, phone, creditLimitPaise, cachedBalancePaise: 0, lastActivityAt: null, promiseDate: null, missedPromises: 0, note: String(data.get('note') || '').trim() }; state.parties.push(party); const opening = parsePaise(data.get('openingAmount')); if (opening && opening > 0) state.transactions.push({ ...baseEntity(), partyId: party.id, type: ui.openingDirection === 'receivable' ? 'gave' : 'got', amountPaise: opening, breakdown: null, note: 'पुराना बकाया', txnDate: todayKey(), dueDate: null, isOpeningBalance: true, photoPaths: [] }); updatePartyBalance(party); party.lastActivityAt = now(); save(); closeModal(); ui.detailId = party.id; ui.view = 'detail'; render(); toast(t('partySaved')); }
  }
  if (form.dataset.form === 'entry') {
    const modal = ui.modal; const result = evaluateExpression(modal.expression); if (!result.ok || result.paise <= 0 || result.paise > MAX_AMOUNT_PAISE) return toast(state.settings.language === 'hi' ? 'Amount सही डालें' : 'Enter a valid amount'); const party = partyById(form.dataset.partyId); const dueDate = modal.type === 'gave' ? String(data.get('dueDate') || '') : null; const txnDate = String(data.get('txnDate') || todayKey()); if (txnDate > todayKey()) return toast(state.settings.language === 'hi' ? 'Future date नहीं चुन सकते' : 'Future dates are not allowed'); if (modal.editingId) { const tx = state.transactions.find(item => item.id === modal.editingId); Object.assign(tx, { amountPaise: result.paise, breakdown: /[+−×÷]/.test(normalizeExpression(modal.expression)) ? normalizeExpression(modal.expression) : null, note: String(data.get('note') || '').trim(), txnDate, dueDate, photoPaths: modal.pendingPhoto ? [modal.pendingPhoto] : (tx.photoPaths || []), updatedAt: now(), version: (tx.version || 1) + 1, syncStatus: 0 }); } else { state.transactions.push({ ...baseEntity(), partyId: party.id, type: modal.type, amountPaise: result.paise, breakdown: /[+−×÷]/.test(normalizeExpression(modal.expression)) ? normalizeExpression(modal.expression) : null, note: String(data.get('note') || '').trim(), txnDate, dueDate, photoPaths: modal.pendingPhoto ? [modal.pendingPhoto] : [], isOpeningBalance: false }); } updatePartyBalance(party); party.lastActivityAt = now(); save(); closeModal(); ui.view = 'detail'; render(); toast(t('entrySaved')); }
  if (form.dataset.form === 'promise') { const party = partyById(form.dataset.partyId); const promiseDate = String(data.get('promiseDate') || ''); if (!promiseDate) return toast(t('selectDate')); const prior = party.promiseDate; if (prior && daysFromToday(prior) < 0 && balanceFor(party.id) > 0) party.missedPromises = (party.missedPromises || 0) + 1; party.promiseDate = promiseDate; mutateParty(party, { promiseDate, missedPromises: party.missedPromises || 0 }); addFollowup({ partyId: party.id, kind: 'promise', promiseDate, note: String(data.get('note') || '').trim() }); closeModal(); render(); toast(t('promiseSaved')); }
  if (form.dataset.form === 'settings-main') { const upiId = String(data.get('upiId') || '').trim(); if (upiId && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) return toast(state.settings.language === 'hi' ? 'UPI ID सही नहीं है' : 'UPI ID is invalid'); state.settings.shopName = String(data.get('shopName') || '').trim(); state.settings.upiId = upiId; state.settings.paymentNote = String(data.get('paymentNote') || '').trim(); state.settings.defaultCreditDays = Math.max(1, Math.min(180, Number(data.get('defaultCreditDays') || 15))); save(); render(); toast(t('partySaved')); }
  if (form.dataset.form === 'templates') { ['friendly','due','firm','final'].forEach(key => { state.settings.templates[key] = String(data.get(key) || '').trim() || defaultTemplates[key]; }); save(); render(); toast(state.settings.language === 'hi' ? 'Templates सेव हो गए' : 'Templates saved'); }
};
document.addEventListener('click', handleClick);
document.addEventListener('input', handleInput);
document.addEventListener('change', handleChange);
document.addEventListener('submit', handleSubmit);
document.addEventListener('change', event => {
  if (event.target.id !== 'restore-file' || !event.target.files?.[0]) return;
  const file = event.target.files[0]; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); const incoming = parsed.data || parsed; if (!incoming.settings || !Array.isArray(incoming.parties) || !Array.isArray(incoming.transactions) || !Array.isArray(incoming.followUps)) throw new Error('invalid'); state = incoming; state.settings = { ...defaults().settings, ...state.settings, deviceId }; save(); render(); toast(t('restored')); } catch { toast(state.settings.language === 'hi' ? 'Backup file सही नहीं है' : 'Backup file is invalid'); } }; reader.readAsText(file); event.target.value = ''; });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
render();
