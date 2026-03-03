const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./database");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

/* =====================================================
   💰 ADD INCOME
===================================================== */

app.post("/add-income", (req, res) => {
  let { amount, source, date } = req.body;

  amount = Number(amount);

  db.run(
    "INSERT INTO income (amount, source, date) VALUES (?, ?, ?)",
    [amount, source, date],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ message: "Income added successfully" });
    }
  );
});

/* =====================================================
   💸 ADD EXPENSE
===================================================== */

app.post("/add-expense", (req, res) => {
  let { amount, category, date } = req.body;

  amount = Number(amount);

  db.run(
    "INSERT INTO expense (amount, category, date) VALUES (?, ?, ?)",
    [amount, category, date],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ message: "Expense added successfully" });
    }
  );
});

/* =====================================================
   📊 MONTHLY SUMMARY
===================================================== */

app.get("/summary", (req, res) => {
  const selectedMonth =
    req.query.month || new Date().toISOString().slice(0, 7);

  db.all(
    `
    SELECT 
      (SELECT IFNULL(SUM(amount),0) FROM income WHERE substr(date,1,7)=?) as totalIncome,
      (SELECT IFNULL(SUM(amount),0) FROM expense WHERE substr(date,1,7)=?) as totalExpense
    `,
    [selectedMonth, selectedMonth],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows[0]);
    }
  );
});

/* =====================================================
   📋 TRANSACTIONS (MONTH FILTERED)
===================================================== */

app.get("/transactions", (req, res) => {

  const month =
    req.query.month || new Date().toISOString().slice(0, 7);

  db.all(
    `
    SELECT id, amount, category as type, date, 'expense' as transactionType
    FROM expense
    WHERE substr(date,1,7)=?

    UNION ALL

    SELECT id, amount, source as type, date, 'income' as transactionType
    FROM income
    WHERE substr(date,1,7)=?

    ORDER BY date DESC, id DESC
    `,
    [month, month],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

/* =====================================================
   🗑 DELETE TRANSACTION
===================================================== */

app.delete("/delete/:type/:id", (req, res) => {
  const { type, id } = req.params;
  const table = type === "income" ? "income" : "expense";

  db.run(`DELETE FROM ${table} WHERE id=?`, [id], function (err) {
    if (err) return res.status(500).json(err);
    res.json({ message: "Deleted successfully" });
  });
});

/* =====================================================
   ❌ CLEAR CURRENT MONTH
===================================================== */

app.delete("/clear-month", (req, res) => {
  const month = req.query.month;

  if (!month) {
    return res.status(400).json({ message: "Month required" });
  }

  db.serialize(() => {
    db.run("DELETE FROM income WHERE substr(date,1,7)=?", [month]);
    db.run("DELETE FROM expense WHERE substr(date,1,7)=?", [month]);
  });

  res.json({ message: "Month data cleared" });
});


/* =====================================================
   💳 EMI SYSTEM
===================================================== */

/* ADD EMI */

app.post("/add-emi", (req, res) => {
  let { name, total_amount, monthly_amount, total_months, start_month } = req.body;

  total_amount = Number(total_amount);
  monthly_amount = Number(monthly_amount);
  total_months = Number(total_months);

  if (!name || !total_amount || !monthly_amount || !total_months) {
    return res.status(400).json({ message: "All fields required" });
  }

  db.run(
    `INSERT INTO emi
    (name, total_amount, monthly_amount, total_months, months_paid, remaining_amount, start_month, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      total_amount,
      monthly_amount,
      total_months,
      0,
      total_amount,
      start_month,
      "Active"
    ],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ message: "EMI added successfully" });
    }
  );
});

/* GET ALL EMI */

app.get("/emis", (req, res) => {
  db.all("SELECT * FROM emi ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

/* PAY EMI */

app.put("/pay-emi/:id", (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM emi WHERE id=?", [id], (err, row) => {
    if (err || !row)
      return res.status(404).json({ message: "EMI not found" });

    if (row.status === "Completed")
      return res.json({ message: "EMI already completed" });

    const newMonthsPaid = row.months_paid + 1;

    let newRemaining = row.remaining_amount - row.monthly_amount;
    if (newRemaining < 0) newRemaining = 0;

    const newStatus =
      newMonthsPaid >= row.total_months ? "Completed" : "Active";

    db.run(
      `UPDATE emi
       SET months_paid=?, remaining_amount=?, status=?
       WHERE id=?`,
      [newMonthsPaid, newRemaining, newStatus, id],
      function (err) {
        if (err) return res.status(500).json(err);
        res.json({ message: "EMI payment updated" });
      }
    );
  });
});

/* DELETE EMI */

app.delete("/delete-emi/:id", (req, res) => {
  db.run("DELETE FROM emi WHERE id=?", [req.params.id], function (err) {
    if (err) return res.status(500).json(err);
    res.json({ message: "EMI deleted successfully" });
  });
});

/* UPDATE EMI */

app.put("/update-emi/:id", (req, res) => {
  const { id } = req.params;

  let {
    name,
    total_amount,
    monthly_amount,
    total_months,
    months_paid,
    start_month
  } = req.body;

  total_amount = Number(total_amount);
  monthly_amount = Number(monthly_amount);
  total_months = Number(total_months);
  months_paid = Number(months_paid || 0);

  if (!name || !total_amount || !monthly_amount || !total_months) {
    return res.status(400).json({ message: "All required fields missing" });
  }

  let remaining_amount = total_amount - monthly_amount * months_paid;
  if (remaining_amount < 0) remaining_amount = 0;

  const status =
    months_paid >= total_months ? "Completed" : "Active";

  db.run(
    `UPDATE emi
     SET name=?, total_amount=?, monthly_amount=?, total_months=?,
         months_paid=?, remaining_amount=?, start_month=?, status=?
     WHERE id=?`,
    [
      name,
      total_amount,
      monthly_amount,
      total_months,
      months_paid,
      remaining_amount,
      start_month,
      status,
      id
    ],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ message: "EMI updated successfully" });
    }
  );
});

/* UPDATE EMI STATUS */

app.put("/update-emi-status/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status)
    return res.status(400).json({ message: "Status required" });

  db.run(
    "UPDATE emi SET status=? WHERE id=?",
    [status, id],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ message: "Status updated successfully" });
    }
  );
});


/* =====================================================
   📊 DASHBOARD ROUTES
===================================================== */

app.get("/expense-category-summary", (req, res) => {
  const month =
    req.query.month || new Date().toISOString().slice(0, 7);

  db.all(
    `
    SELECT category, SUM(amount) as total
    FROM expense
    WHERE substr(date,1,7)=?
    GROUP BY category
    `,
    [month],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

/* =====================================================
   📊 MONTHLY INCOME VS EXPENSE (YEAR DATA)
===================================================== */

app.get("/monthly-summary", (req, res) => {

  const year = req.query.year || new Date().getFullYear();

  db.all(
    `
    SELECT 
      strftime('%m', date) as month,
      SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
    FROM (
      SELECT amount, date, 'income' as type FROM income
      UNION ALL
      SELECT amount, date, 'expense' as type FROM expense
    )
    WHERE substr(date,1,4)=?
    GROUP BY month
    ORDER BY month
    `,
    [year],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

/* =====================================================
   🚀 START SERVER
===================================================== */

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});