const CATEGORIES = {
  expense: [
    { name: 'Еда', icon: '◒', color: '#7868e9' },
    { name: 'Транспорт', icon: '↗', color: '#a69af2' },
    { name: 'Покупки', icon: '▢', color: '#55c7a6' },
    { name: 'Дом и счета', icon: '⌂', color: '#f1b85c' },
    { name: 'Здоровье', icon: '＋', color: '#ec839d' },
    { name: 'Развлечения', icon: '♫', color: '#64a9e8' },
    { name: 'Другое', icon: '•••', color: '#bec2cd' },
  ],
  income: [
    { name: 'Зарплата', icon: '₸', color: '#32b994' },
    { name: 'Подработка', icon: '↗', color: '#62c6a6' },
    { name: 'Подарок', icon: '◇', color: '#8a7cec' },
    { name: 'Инвестиции', icon: '▥', color: '#64a9e8' },
    { name: 'Другое', icon: '•••', color: '#bec2cd' },
  ],
};
const COLORS = ['#7868e9', '#a69af2', '#55c7a6', '#f1b85c', '#ec839d', '#64a9e8', '#bec2cd'];
const STORAGE = 'moneytracker-v1';
const money = (n) => `₸ ${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.abs(n || 0))}`;
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthName = (date) => new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date);
const dateLabel = (value) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
let state = loadState();
let selectedMonth = new Date(); selectedMonth.setDate(1);
let showFullHistory = false;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (saved && Array.isArray(saved.transactions)) return { transactions: saved.transactions, budgets: saved.budgets || {} };
  } catch (error) { console.warn('Не удалось загрузить данные', error); }
  return { transactions: [], budgets: {} };
}
function persist() { localStorage.setItem(STORAGE, JSON.stringify(state)); }
function transactionsForMonth() { const key = monthKey(selectedMonth); return state.transactions.filter(t => t.date.slice(0, 7) === key); }
function render() {
  const list = transactionsForMonth();
  const income = list.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = list.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const budget = Number(state.budgets[monthKey(selectedMonth)] || 0);
  document.getElementById('monthTitle').textContent = monthName(selectedMonth);
  document.getElementById('balanceValue').textContent = money(income - expenses);
  document.getElementById('incomeValue').textContent = money(income);
  document.getElementById('expenseValue').textContent = money(expenses);
  document.getElementById('incomeCount').textContent = `${list.filter(t => t.type === 'income').length} ${plural(list.filter(t => t.type === 'income').length, 'операция', 'операции', 'операций')}`;
  document.getElementById('expenseCount').textContent = `${list.filter(t => t.type === 'expense').length} ${plural(list.filter(t => t.type === 'expense').length, 'операция', 'операции', 'операций')}`;
  document.getElementById('budgetSpent').textContent = money(expenses);
  document.getElementById('budgetLimit').textContent = money(budget);
  const pct = budget > 0 ? Math.round(expenses / budget * 100) : 0;
  const progress = document.getElementById('budgetProgress'); progress.style.width = `${Math.min(100, pct)}%`; progress.classList.toggle('over', pct > 100);
  document.getElementById('budgetPercent').textContent = `${pct}% использовано`;
  document.getElementById('budgetLeft').textContent = budget ? (expenses > budget ? `Превышение ${money(expenses - budget)}` : `Осталось ${money(budget - expenses)}`) : 'Задай лимит расходов';
  document.getElementById('budgetNote').innerHTML = budget && pct >= 100 ? '<span>!</span> Бюджет превышен — проверь расходы.' : budget && pct >= 80 ? '<span>✦</span> Осталось меньше 20% бюджета. Будь внимателен.' : '<span>✦</span> Хорошее начало! Продолжай следить за расходами.';
  renderChart(list); renderCategories(list.filter(t => t.type === 'expense')); renderHistory(list);
}
function plural(n, one, few, many) { const x=n%100; if(x>10&&x<20)return many; const y=n%10; return y===1?one:y>1&&y<5?few:many; }
function renderChart(list) {
  const groups = Array.from({length:6}, (_,i)=>({income:0,expense:0}));
  list.forEach(t=>{const day=Number(t.date.slice(8)); const index=Math.min(5,Math.floor((day-1)/5)); groups[index][t.type]+=t.amount;});
  const max = Math.max(300000, ...groups.flatMap(g=>[g.income,g.expense]));
  document.getElementById('monthlyChart').innerHTML = groups.map(g=>`<div class="bar-group"><div class="bar income" title="Доходы ${money(g.income)}" style="height:${g.income/max*100}%"></div><div class="bar expense" title="Расходы ${money(g.expense)}" style="height:${g.expense/max*100}%"></div></div>`).join('');
}
function renderCategories(expenses) {
  const totals = CATEGORIES.expense.map(c=>({...c, amount:expenses.filter(t=>t.category===c.name).reduce((s,t)=>s+t.amount,0)})).filter(c=>c.amount>0).sort((a,b)=>b.amount-a.amount);
  const sum = totals.reduce((s,c)=>s+c.amount,0); document.getElementById('categoryTotal').textContent=money(sum);
  const donut=document.getElementById('categoryDonut');
  if(!sum){donut.style.background='#f0eff5';document.getElementById('categoryLegend').innerHTML='<span class="category-row">Добавь расходы, чтобы увидеть категории</span>';return;}
  let angle=0; const slices=totals.map(c=>{const start=angle;angle+=c.amount/sum*360;return `${c.color} ${start}deg ${angle}deg`;}); donut.style.background=`conic-gradient(${slices.join(',')})`;
  document.getElementById('categoryLegend').innerHTML=totals.slice(0,5).map(c=>`<div class="category-row"><i style="background:${c.color}"></i>${escapeHtml(c.name)}<b>${Math.round(c.amount/sum*100)}%</b></div>`).join('');
}
function renderHistory(list) {
  const sorted=[...list].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  const rows=showFullHistory?sorted:sorted.slice(0,5);
  document.getElementById('historyList').classList.toggle('hidden',!rows.length); document.getElementById('emptyState').classList.toggle('hidden',!!rows.length);
  document.getElementById('historyList').innerHTML=rows.map(t=>{const cat=CATEGORIES[t.type].find(c=>c.name===t.category)||CATEGORIES[t.type].at(-1);return `<div class="transaction-row"><div class="transaction-icon ${t.type}">${cat.icon}</div><div><div class="transaction-name">${escapeHtml(t.description||t.category)}</div><div class="transaction-category">${escapeHtml(t.category)}</div></div><div class="transaction-date">${dateLabel(t.date)}</div><div class="transaction-amount ${t.type}">${t.type==='income'?'+':'−'} ${money(t.amount)}</div><button class="delete-transaction" data-delete="${t.id}" title="Удалить">×</button></div>`;}).join('');
}
function escapeHtml(s='') { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const modal=document.getElementById('transactionModal');
function openModal(){modal.classList.remove('hidden');document.getElementById('dateInput').value=todayISO();document.getElementById('amountInput').focus();}
function closeModal(){modal.classList.add('hidden');document.getElementById('transactionForm').reset();setType('expense');}
function setType(type){document.getElementById('formType').value=type;document.querySelectorAll('.type-choice').forEach(b=>b.classList.toggle('selected',b.dataset.type===type));document.getElementById('categoryInput').innerHTML=CATEGORIES[type].map(c=>`<option>${c.name}</option>`).join('');}
document.getElementById('addBtn').addEventListener('click',openModal); document.getElementById('emptyAdd').addEventListener('click',openModal);
document.getElementById('closeModal').addEventListener('click',closeModal); modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
document.querySelectorAll('.type-choice').forEach(b=>b.addEventListener('click',()=>setType(b.dataset.type)));
document.getElementById('transactionForm').addEventListener('submit',e=>{e.preventDefault();const amount=Number(document.getElementById('amountInput').value);if(!Number.isFinite(amount)||amount<=0)return;state.transactions.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),type:document.getElementById('formType').value,amount,category:document.getElementById('categoryInput').value,date:document.getElementById('dateInput').value,description:document.getElementById('descriptionInput').value.trim(),createdAt:Date.now()});persist();render();closeModal();showToast('Операция сохранена');});
document.getElementById('historyList').addEventListener('click',e=>{const id=e.target.dataset.delete;if(id){state.transactions=state.transactions.filter(t=>t.id!==id);persist();render();showToast('Операция удалена');}});
document.getElementById('budgetEdit').addEventListener('click',()=>{const current=state.budgets[monthKey(selectedMonth)]||'';const answer=prompt(`Месячный лимит расходов для «${monthName(selectedMonth)}» (₸):`,current);if(answer===null)return;const n=Number(answer.replace(/\s/g,''));if(!Number.isFinite(n)||n<0){showToast('Введи корректную сумму');return;}state.budgets[monthKey(selectedMonth)]=n;persist();render();showToast('Бюджет обновлён');});
document.getElementById('prevMonth').addEventListener('click',()=>{selectedMonth.setMonth(selectedMonth.getMonth()-1);render();});document.getElementById('nextMonth').addEventListener('click',()=>{selectedMonth.setMonth(selectedMonth.getMonth()+1);render();});document.getElementById('currentMonth').addEventListener('click',()=>{selectedMonth=new Date();selectedMonth.setDate(1);render();});
// Treat sidebar links as real app navigation, with a clear destination and active state.
document.querySelectorAll('.nav-item').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  const destination=link.getAttribute('href');
  document.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item===link));
  if(destination==='#history'){
    showFullHistory=true; render();
    document.body.classList.remove('view-overview','view-analytics');
    document.body.classList.add('view-operations');
  }else if(destination==='#analytics'){
    document.body.classList.remove('view-overview','view-operations');
    document.body.classList.add('view-analytics');
  }else{
    showFullHistory=false; render();
    document.body.classList.remove('view-operations','view-analytics');
    document.body.classList.add('view-overview');
  }
  window.scrollTo({top:0,behavior:'smooth'});
}));
document.getElementById('showAll').addEventListener('click',()=>{
  showFullHistory=!showFullHistory;
  document.getElementById('showAll').innerHTML=showFullHistory?'Свернуть <span>↑</span>':'Все операции <span>→</span>';
  render();
});
document.getElementById('exportBtn').addEventListener('click',()=>{const items=state.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date));const csv=['Дата;Тип;Категория;Описание;Сумма',...items.map(t=>`${t.date};${t.type==='income'?'Доход':'Расход'};${t.category};${(t.description||'').replaceAll(';',',')};${t.amount}`)].join('\n');download(csv,`moneytracker-all.csv`,'text/csv;charset=utf-8;');showToast('История экспортирована в CSV');});
function download(data,name,type){const blob=new Blob(['\ufeff'+data],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
let toastTimer;function showToast(message){const toast=document.getElementById('toast');toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2300);}
setType('expense');render();
