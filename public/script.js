/* =================================================
💰 GLOBAL HELPERS
================================================= */

function formatCurrency(amount) {
  return "₹ " + Number(amount || 0).toLocaleString("en-IN");
}

/* =================================================
📊 FETCH SUMMARY (FINANCE TAB)
================================================= */

async function fetchSummary() {
  const month = document.getElementById("monthSelector")?.value;
  const res = await fetch(`/summary?month=${month || ""}`);
  const data = await res.json();

  const income = Number(data.totalIncome || 0);
  const expense = Number(data.totalExpense || 0);

  document.getElementById("income").innerText = formatCurrency(income);
document.getElementById("expense").innerText = formatCurrency(expense);
document.getElementById("balance").innerText = formatCurrency(income - expense);
}

/* =================================================
💰 ADD INCOME
================================================= */

async function addIncome() {
  const amount = incAmount.value;
  const source = incSource.value;
  const dateInput = incDate.value;

  if (!amount || !source) return alert("Enter amount & source");

  const date = dateInput
    ? new Date(dateInput).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  await fetch("/add-income", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, source, date })
  });

  incAmount.value = "";
  incSource.value = "";
  incDate.value = "";

  fetchSummary();
  fetchTransactions();
  loadDashboardCharts();
}

/* =================================================
💸 ADD EXPENSE
================================================= */

async function addExpense() {
  const amount = expAmount.value;
  let category = expCategory.value;
  const custom = otherCategory.value;
  const dateInput = expDate.value;

  if (category === "Other") category = custom;
  if (!amount || !category) return alert("Enter amount & category");

  const date = dateInput
    ? new Date(dateInput).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  await fetch("/add-expense", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, category, date })
  });

  expAmount.value = "";
  expCategory.value = "";
  otherCategory.value = "";
  expDate.value = "";

  fetchSummary();
  fetchTransactions();
  loadDashboardCharts();
}

/* =================================================
🔄 CATEGORY TOGGLE
================================================= */

function toggleOtherCategory() {
  if (expCategory.value === "Other") {
    otherCategory.style.display = "block";
  } else {
    otherCategory.style.display = "none";
    otherCategory.value = "";
  }
}

/* =================================================
📋 TRANSACTIONS
================================================= */

async function fetchTransactions() {
  const month = document.getElementById("monthSelector")?.value;
  const res = await fetch(`/transactions?month=${month || ""}`);
  const data = await res.json();

  const tbody = document.querySelector("#transactionTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  data.forEach(item => {
    tbody.innerHTML += `
  <tr>
    <td>${item.transactionType}</td>
    <td>${formatCurrency(item.amount)}</td>
    <td>${item.type}</td>
    <td>${new Date(item.date).toLocaleDateString("en-US")}</td>
    <td>
      <button onclick="deleteTransaction(${item.id},'${item.transactionType}')">
        Delete
      </button>
    </td>
  </tr>`;
  });
}

async function deleteTransaction(id, type) {
  if (!confirm("Delete?")) return;
  await fetch(`/delete/${type}/${id}`, { method: "DELETE" });
  fetchSummary();
  fetchTransactions();
  loadDashboardCharts();
}

/* =================================================
💳 EMI SYSTEM (UNCHANGED)
================================================= */

let editingEmiId = null;
let currentMonthsPaid = 0;

async function addOrUpdateEmi() {
  const name = document.getElementById("emiName").value;
  const total_amount = document.getElementById("emiTotal").value;
  const monthly_amount = document.getElementById("emiMonthly").value;
  const total_months = document.getElementById("emiMonths").value;
  const start_month = document.getElementById("emiStartMonth").value;

  if (!name || !total_amount || !monthly_amount || !total_months || !start_month)
    return alert("Fill EMI details");

  const data = {
    name,
    total_amount,
    monthly_amount,
    total_months,
    start_month,
    months_paid: currentMonthsPaid
  };

  if (editingEmiId) {
    await fetch(`/update-emi/${editingEmiId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  } else {
    await fetch("/add-emi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  }

  resetEmiForm();
  fetchEmis();
  loadDashboardCharts();
}

async function fetchEmis() {
  const res = await fetch("/emis");
  const data = await res.json();

  const tbody = document.querySelector("#emiTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  data.forEach(i => {
    let badgeClass =
      i.status === "Active"
        ? "status-active"
        : i.status === "Inactive"
        ? "status-inactive"
        : "status-completed";

    tbody.innerHTML += `
      <tr>
        <td>${i.name}</td>
        <td>${formatCurrency(i.total_amount)}</td>
        <td>${formatCurrency(i.monthly_amount)}</td>
        <td>
          <div class="progress-bar-container">
             <div class="progress-bar-fill"
               style="width:${(i.months_paid/i.total_months)*100}%">
             </div>
          </div>
            <small>${i.months_paid}/${i.total_months}</small>
        </td>
        <td>${formatCurrency(i.remaining_amount)}</td>
        <td>
          <select onchange="updateEmiStatus(${i.id},this.value)">
            <option value="Active" ${i.status==="Active"?"selected":""}>Active</option>
            <option value="Inactive" ${i.status==="Inactive"?"selected":""}>Inactive</option>
            <option value="Completed" ${i.status==="Completed"?"selected":""}>Completed</option>
          </select>
          <span class="${badgeClass}">${i.status}</span>
        </td>
        <td>
          <button onclick="payEmi(${i.id})">Pay</button>
          <button onclick="deleteEmi(${i.id})">Delete</button>
        </td>
      </tr>`;
  });
}

async function updateEmiStatus(id, status) {
  await fetch(`/update-emi-status/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });

  fetchEmis();
  loadDashboardCharts();
}

async function payEmi(id) {
  await fetch(`/pay-emi/${id}`, { method: "PUT" });
  fetchEmis();
  loadDashboardCharts();
}

async function deleteEmi(id) {
  if (!confirm("Delete EMI?")) return;
  await fetch(`/delete-emi/${id}`, { method: "DELETE" });
  fetchEmis();
  loadDashboardCharts();
}

function resetEmiForm() {
  editingEmiId = null;
  currentMonthsPaid = 0;
  document.getElementById("emiName").value = "";
  document.getElementById("emiTotal").value = "";
  document.getElementById("emiMonthly").value = "";
  document.getElementById("emiMonths").value = "";
  document.getElementById("emiStartMonth").value = "";
}

/* =================================================
📊 DASHBOARD CHART SYSTEM
================================================= */

let monthlyTrendChartInstance = null;
let expensePieChartInstance = null;
let emiStatusChartInstance = null;
let emiAmountChartInstance = null;

async function loadDashboardCharts() {

  const selectedYear =
    document.getElementById("yearSelector")?.value
    || new Date().getFullYear();

  const selectedMonth =
    document.getElementById("dashboardMonthSelector")?.value
    || new Date().toISOString().slice(5,7);

  const selectedYearMonth = `${selectedYear}-${selectedMonth}`;

  /* ===== YEAR TREND ===== */

  const yearlyRes = await fetch(`/monthly-summary?year=${selectedYear}`);
  const yearlyData = await yearlyRes.json();

  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];

  let incomeData = new Array(12).fill(0);
  let expenseData = new Array(12).fill(0);

  yearlyData.forEach(row => {
    const index = parseInt(row.month) - 1;
    incomeData[index] = row.income;
    expenseData[index] = row.expense;
  });

  if (monthlyTrendChartInstance) monthlyTrendChartInstance.destroy();

  monthlyTrendChartInstance = new Chart(
    document.getElementById("monthlyTrendChart"),
    {
      type: "bar",
      data: {
        labels: months,
        datasets: [
          { label: "Income", data: incomeData, backgroundColor: "#27ae60" },
          { label: "Expense", data: expenseData, backgroundColor: "#e74c3c" }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    }
  );

  /* ===== EXPENSE PIE ===== */

  const expenseRes = await fetch(`/expense-category-summary?month=${selectedYearMonth}`);
  const expenseDataRes = await expenseRes.json();

  if (expensePieChartInstance) expensePieChartInstance.destroy();

  expensePieChartInstance = new Chart(
    document.getElementById("expensePieChart"),
    {
      type: "pie",
      data: {
        labels: expenseDataRes.map(e => e.category),
        datasets: [{
          data: expenseDataRes.map(e => e.total),
          backgroundColor: [
            "#3498db","#9b59b6","#f1c40f",
            "#e67e22","#1abc9c","#e74c3c",
            "#2ecc71","#34495e"
          ]
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    }
  );

  /* ===== EMI CHARTS ===== */

  const emiRes = await fetch("/emis");
  const emiData = await emiRes.json();

  let active = 0, inactive = 0, completed = 0;
  let totalPaid = 0, totalRemaining = 0;

  emiData.forEach(e => {
    if (e.status === "Active") active++;
    if (e.status === "Inactive") inactive++;
    if (e.status === "Completed") completed++;

    totalPaid += e.months_paid * e.monthly_amount;
    totalRemaining += e.remaining_amount;
  });

  if (emiStatusChartInstance) emiStatusChartInstance.destroy();

  emiStatusChartInstance = new Chart(
    document.getElementById("emiStatusChart"),
    {
      type: "pie",
      data: {
        labels: ["Active","Inactive","Completed"],
        datasets: [{
          data: [active, inactive, completed],
          backgroundColor: ["#27ae60","#e74c3c","#34495e"]
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    }
  );

  if (emiAmountChartInstance) emiAmountChartInstance.destroy();

  emiAmountChartInstance = new Chart(
    document.getElementById("emiAmountChart"),
    {
      type: "bar",
      data: {
        labels: ["Total Paid","Remaining"],
        datasets: [{
          label: "Amount",
          data: [totalPaid, totalRemaining],
          backgroundColor: ["#3498db","#f39c12"]
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    }
  );
}

/* =================================================
🎨 TAB SWITCH
================================================= */

function showTab(e, id) {
  document.querySelectorAll(".tab-content")
    .forEach(t => t.classList.remove("active"));

  document.querySelectorAll(".tab-btn")
    .forEach(b => b.classList.remove("active"));

  document.getElementById(id).classList.add("active");
  e.target.classList.add("active");

  localStorage.setItem("activeTab", id);

  if (id === "dashboardTab") loadDashboardCharts();
  if (id === "financeTab") {
    fetchSummary();
    fetchTransactions();
  }
  if (id === "emiTab") fetchEmis();
}

/* =================================================
🚀 INITIAL LOAD
================================================= */

window.onload = () => {

  const currentYear = new Date().getFullYear();
  const yearSelector = document.getElementById("yearSelector");

  if (yearSelector) {
    for (let y = currentYear; y >= currentYear - 5; y--) {
      const option = document.createElement("option");
      option.value = y;
      option.textContent = y;
      yearSelector.appendChild(option);
    }
    yearSelector.value = currentYear;
  }

  const savedTab = localStorage.getItem("activeTab") || "dashboardTab";
  const btn = document.querySelector(
    `.tab-btn[onclick="showTab(event,'${savedTab}')"]`
  );

  if (btn) showTab({ target: btn }, savedTab);
};