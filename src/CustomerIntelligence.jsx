import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Users,
  UserCheck,
  Wallet,
  ArrowLeftRight,
} from "lucide-react";
import "./CustomerIntelligence.css";
import { translations } from "./translations";

const number = (value, locale = "en-US") =>
  new Intl.NumberFormat(locale).format(Number(value || 0));

const statusColors = {
  active: "#29966d",
  inactive: "#e3ae4c",
  blocked: "#d86b70",
  closed: "#8994a6",
  completed: "#29966d",
  pending: "#e3ae4c",
  failed: "#d86b70",
};

const label = (value, language = "en") => {
  const labels = {
    active: "Active",
    inactive: "Inactive",
    blocked: "Blocked",
    closed: "Closed",
    completed: "Completed",
    pending: "Pending",
    failed: "Failed",
    current: "Current Account",
    savings: "Savings Account",
    business: "Business Account",
    deposit: "Deposit",
    transfer: "Transfer",
    withdrawal: "Withdrawal",
    bill_payment: "Bill Payment",
    individual: "Individual Customer",
    corporate: "Corporate Customer",
  };
  const frenchLabels = {
    active: "Actif",
    inactive: "Inactif",
    blocked: "Bloqué",
    closed: "Clôturé",
    completed: "Terminé",
    pending: "En attente",
    failed: "Échoué",
    current: "Compte courant",
    savings: "Compte d’épargne",
    business: "Compte professionnel",
    deposit: "Dépôt",
    transfer: "Virement",
    withdrawal: "Retrait",
    bill_payment: "Paiement de facture",
    individual: "Client particulier",
    corporate: "Client entreprise",
  };
  return (language === "fr" ? frenchLabels[value] : labels[value]) || value || "—";
};


const translateBackendText = (value, language = "en") => {
  if (!value) return "—";

  const translationsMap = {
    "kunde war kürzlich aktiv": {
      en: "Customer was recently active",
      fr: "Le client a été récemment actif",
    },
    "kundenbindung weiter stärken": {
      en: "Strengthen customer retention",
      fr: "Renforcer la fidélisation du client",
    },
  };

  const key = String(value).trim().toLowerCase();
  return translationsMap[key]?.[language] || value;
};

const riskLabel = (risk, language = "en") => {
  const labels = {
    low: { en: "Low", fr: "Faible" },
    medium: { en: "Medium", fr: "Moyen" },
    high: { en: "High", fr: "Élevé" },
  };

  return labels[String(risk || "").toLowerCase()]?.[language] || risk || "—";
};

function KpiCard({ title, value, icon: Icon, tone, footnote }) {
  return (
    <div className="ci-kpi-card">
      <div className="ci-kpi-top">
        <span>{title}</span>
        <span className={`ci-kpi-icon ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="ci-kpi-value">{number(value)}</div>
      <div className="ci-kpi-foot">{footnote}</div>
    </div>
  );
}

function Panel({ title, subtitle, children, demoLabel }) {
  return (
    <section className="panel ci-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="ci-demo-tag">{demoLabel}</span>
      </div>
      {children}
    </section>
  );
}

export default function CustomerIntelligence({
  customerData,
  activityData,
  segmentationData,
  churnData,
  loading,
  error,
  bank,
  language = "en",
}) {
  const t = translations[language] || translations.en;
  const footnote = t.syntheticData;
  const locale = language === "fr" ? "fr-FR" : "en-US";
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customer360, setCustomer360] = useState(null);
  const [customer360Loading, setCustomer360Loading] = useState(false);
  const [customer360Error, setCustomer360Error] = useState("");

  const loadCustomer360 = (customer) => {
    setSelectedCustomer(customer);
    setCustomer360Error("");
    setCustomer360Loading(false);

    // Build the public demo profile from the available synthetic customer record.
    // No backend request and no fabricated account or transaction records.
    setCustomer360({
      customer: {
        ...customer,
        customer_type: null,
        branch_id: null,
      },
      analytics: {
        transaction_count: Number(customer.transaction_count || 0),
        completed_transactions: Number(customer.completed_transactions || 0),
        transaction_volume_by_currency: customer.transaction_volume_by_currency || [],
        accounts_by_currency: [],
      },
      accounts: [],
      transactions: [],
    });
  };

  if (loading) {
    return <div className="panel ci-message">{t.loading}</div>;
  }

  if (error) {
    return <div className="panel ci-message ci-error">{error}</div>;
  }

  if (!customerData?.customers || !activityData?.accounts || !activityData?.transactions) {
    return (
      <div className="panel ci-message">
        {t.noData}
      </div>
    );
  }

  const customers = customerData.customers;
  const statusRows = customers.by_status || [];
  const accountRows = activityData.accounts.by_type_status_currency || [];
  const transactionRows =
    activityData.transactions.by_type_status_currency ||
    activityData.transactions.by_type_direction_status_currency ||
    [];

  const customerCounts = statusRows.reduce((result, row) => {
    const key = row.customer_status;
    result[key] = (result[key] || 0) + Number(row.total || 0);
    return result;
  }, {});

  const activeCustomers = customerCounts.active || 0;
  const inactiveCustomers = customerCounts.inactive || 0;
  const blockedCustomers = customerCounts.blocked || 0;

  const monthlyMap = new Map();
  (customers.new_customers_by_month || []).forEach((row) => {
    monthlyMap.set(
      row.month,
      (monthlyMap.get(row.month) || 0) + Number(row.new_customers || 0)
    );
  });

  const monthlyData = Array.from(monthlyMap, ([month, newCustomers]) => ({
    month,
    newCustomers,
    monthLabel: month,
  }));

  const accountMap = new Map();
  accountRows.forEach((row) => {
    const type = row.account_type || "other";
    const status = row.account_status || "unknown";
    if (!accountMap.has(type)) accountMap.set(type, { accountType: label(type, language) });
    const entry = accountMap.get(type);
    entry[status] = (entry[status] || 0) + Number(row.total || 0);
  });
  const accountChartData = Array.from(accountMap.values());
  const accountStatuses = [...new Set(accountRows.map((row) => row.account_status))];

  const transactionMap = new Map();
  transactionRows.forEach((row) => {
    const type = row.transaction_type || "other";
    const status = row.transaction_status || "unknown";
    if (!transactionMap.has(type)) {
      transactionMap.set(type, { transactionType: label(type, language) });
    }
    const entry = transactionMap.get(type);
    entry[status] = (entry[status] || 0) + Number(row.total || 0);
  });
  const transactionChartData = Array.from(transactionMap.values());
  const transactionStatuses = [...new Set(transactionRows.map((row) => row.transaction_status))];

  const customerTypeChartData = (segmentationData?.customer_types || []).map((row) => ({
    customerType:
      row.customer_type === "individual"
        ? "Individual Customer"
        : row.customer_type === "corporate"
          ? "Corporate Customer"
          : label(row.customer_type),
    total: Number(row.total || 0),
  }));

  const ageChartData = (segmentationData?.age_groups || []).map((row) => ({
    ageGroup: row.age_group,
    total: Number(row.total || 0),
  }));

  const branchChartData = (segmentationData?.by_branch || []).map((row) => ({
    branch: `${row.branch_name}${row.city ? ` · ${row.city}` : ""}`,
    customers: Number(row.total || 0),
  }));

  const filteredChurnCustomers = (churnData?.customers || [])
    .filter((customer) => {
      const matchesSearch = String(customer.customer_id)
        .toLowerCase()
        .includes(searchTerm.trim().toLowerCase());

      const matchesRisk =
        riskFilter === "all" || customer.risk === riskFilter;

      return matchesSearch && matchesRisk;
    });

  return (
    <div className="ci-page">
      <div className="ci-notice">
        <span className="ci-notice-dot" />
        <div>
          <strong>{footnote}</strong>
          <span>
            This Customer Intelligence view uses test or demo records
            and is not a real-time customer analysis.
          </span>
        </div>
      </div>

      <div className="kpi-grid ci-kpi-grid">
        <KpiCard
          title={t.totalCustomers}
          value={customers.total}
          icon={Users}
          tone="blue"
          footnote={footnote}
        />
        <KpiCard
          title={t.activeCustomers}
          value={activeCustomers}
          icon={UserCheck}
          tone="green"
          footnote={footnote}
        />
        <KpiCard
          title={t.totalAccounts}
          value={activityData.accounts.total}
          icon={Wallet}
          tone="gold"
          footnote={footnote}
        />
        <KpiCard
          title={t.transactions}
          value={activityData.transactions.total}
          icon={ArrowLeftRight}
          tone="violet"
          footnote={footnote}
        />
      </div>

      {churnData && (
        <section className="panel ci-panel">
          <div className="panel-heading">
            <div>
              <h2>{t.churnRiskAnalysis}</h2>
              <p>{t.ruleBasedAssessment}</p>
            </div>
            <span className="ci-demo-tag">{t.demoSimulation}</span>
          </div>

          <div className="kpi-grid ci-kpi-grid">
            {[
              { key: "low", title: "Low Risk", color: "#29966d" },
              { key: "medium", title: "Medium Risk", color: "#d49a35" },
              { key: "high", title: "High Risk", color: "#d86b70" },
            ].map((risk) => (
              <div className="ci-kpi-card" key={risk.key}>
                <div className="ci-kpi-top">
                  <span>{risk.title}</span>
                  <span
                    className="ci-kpi-icon"
                    style={{ color: risk.color }}
                  >
                    ●
                  </span>
                </div>
                <div className="ci-kpi-value">
                  {number(churnData.risk_counts?.[risk.key] || 0)}
                </div>
                <div className="ci-kpi-foot">{footnote}</div>
              </div>
            ))}
          </div>

          <p className="ci-footnote">
            {bank === "corn" ? (
              <>
                {t.bmiCornMethod}
                {churnData.reference_date
                  ? ` (${new Date(churnData.reference_date).toLocaleDateString(locale)}).`
                  : "."}
                {" "}{t.notRealtime}
              </>
            ) : (
              <>
                {t.sedadMethod}
              </>
            )}
            {" "}{t.simulationMethod}
          </p>

          <h3 style={{ marginTop: 24 }}>{t.customerOverview}</h3>
          <p className="ci-footnote">
            {number(filteredChurnCustomers.length)} {t.matchingCustomers}{" "}
            {number(churnData.total_customers)}. {t.max15}
          </p>

          <div style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16
          }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t.searchCustomer}
              aria-label={t.searchCustomerAria}
              style={{
                flex: "1 1 220px",
                minWidth: 0,
                padding: "11px 12px",
                border: "1px solid var(--border-color, #e5e7eb)",
                borderRadius: 8,
                background: "var(--card-bg, transparent)",
                color: "inherit"
              }}
            />

            <select
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value)}
              aria-label={t.filterRisk}
              style={{
                flex: "0 1 190px",
                padding: "11px 12px",
                border: "1px solid var(--border-color, #e5e7eb)",
                borderRadius: 8,
                background: "var(--card-bg, transparent)",
                color: "inherit"
              }}
            >
              <option value="all">{t.allRisk}</option>
              <option value="low">{t.lowRisk}</option>
              <option value="medium">{t.mediumRisk}</option>
              <option value="high">{t.highRisk}</option>
            </select>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              textAlign: "left"
            }}>
              <thead>
                <tr>
                  {[t.customerId, t.status, t.inactiveFor, t.risk, t.tableReason, t.recommendation].map((heading) => (
                    <th key={heading} style={{
                      padding: "12px 10px",
                      borderBottom: "1px solid var(--border-color, #e5e7eb)",
                      whiteSpace: "nowrap"
                    }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredChurnCustomers.slice(0, 15).map((customer) => {
                  const riskColor = customer.risk === "high"
                    ? "#d86b70"
                    : customer.risk === "medium"
                      ? "#d49a35"
                      : "#29966d";

                  return (
                    <tr
                      key={customer.customer_id}
                      onClick={() => loadCustomer360(customer)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          loadCustomer360(customer);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      title={t.viewCustomer}
                      style={{
                        cursor: "pointer",
                        background: selectedCustomer?.customer_id === customer.customer_id
                          ? "var(--hover-bg, rgba(100, 116, 139, 0.10))"
                          : "transparent"
                      }}
                    >
                      <td style={{ padding: "11px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>
                        {customer.customer_id}
                      </td>
                      <td style={{ padding: "11px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>
                        {label(customer.customer_status, language)}
                      </td>
                      <td style={{ padding: "11px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>
                        {customer.days_inactive == null ? t.noSuccessfulTransaction : `${number(customer.days_inactive)} ${t.days}`}
                      </td>
                      <td style={{ padding: "11px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)", color: riskColor, fontWeight: 600 }}>
                        {customer.risk === "high" ? t.highRisk : customer.risk === "medium" ? t.mediumRisk : t.lowRisk}
                      </td>
                      <td style={{ padding: "11px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)", minWidth: 170 }}>
                        {translateBackendText(customer.risk_reason, language)}
                      </td>
                      <td style={{ padding: "11px 10px", borderBottom: "1px solid var(--border-color, #e5e7eb)", minWidth: 190 }}>
                        {translateBackendText(customer.recommendation, language)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedCustomer && (
            <div
              className="panel"
              style={{
                marginTop: 20,
                padding: 20,
                border: "1px solid var(--border-color, #e5e7eb)",
                borderLeft: `5px solid ${
                  selectedCustomer.risk === "high" ? "#d86b70" :
                  selectedCustomer.risk === "medium" ? "#d49a35" : "#29966d"
                }`,
                borderRadius: 12
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap"
              }}>
                <div>
                  <h3 style={{ margin: 0 }}>{t.customerDetails}</h3>
                  <p className="ci-footnote">
                    {t.customerId}: {selectedCustomer.customer_id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomer360(null);
                    setCustomer360Error("");
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color, #e5e7eb)",
                borderLeft: `5px solid ${
                  selectedCustomer.risk === "high" ? "#d86b70" :
                  selectedCustomer.risk === "medium" ? "#d49a35" : "#29966d"
                }`,
                borderRadius: 12,
                    background: "transparent",
                    color: "inherit",
                    cursor: "pointer"
                  }}
                >
                  {t.close}
                </button>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
                marginTop: 18
              }}>
                <div style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--hover-bg, rgba(100, 116, 139, 0.08))",
                  border: "1px solid var(--border-color, #e5e7eb)"
                }}>
                  <p className="ci-footnote">{t.customerStatus}</p>
                  <strong>{label(selectedCustomer.customer_status, language)}</strong>
                </div>
                <div style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--hover-bg, rgba(100, 116, 139, 0.08))",
                  border: "1px solid var(--border-color, #e5e7eb)"
                }}>
                  <p className="ci-footnote">{t.activeAccounts}</p>
                  <strong>{number(selectedCustomer.active_accounts)}</strong>
                </div>
                <div style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--hover-bg, rgba(100, 116, 139, 0.08))",
                  border: "1px solid var(--border-color, #e5e7eb)"
                }}>
                  <p className="ci-footnote">{t.inactiveFor}</p>
                  <strong>
                    {selectedCustomer.days_inactive == null
                      ? t.noSuccessfulTransaction
                      : `${number(selectedCustomer.days_inactive)} ${t.days}`}
                  </strong>
                </div>
                <div style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--hover-bg, rgba(100, 116, 139, 0.08))",
                  border: "1px solid var(--border-color, #e5e7eb)"
                }}>
                  <p className="ci-footnote">{t.lastTransaction}</p>
                  <strong>
                    {selectedCustomer.last_transaction
                      ? new Date(selectedCustomer.last_transaction).toLocaleString(locale)
                      : t.noSuccessfulTransaction}
                  </strong>
                </div>
                <div style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--hover-bg, rgba(100, 116, 139, 0.08))",
                  border: "1px solid var(--border-color, #e5e7eb)"
                }}>
                  <p className="ci-footnote">{t.churnRisk}</p>
                  <strong style={{
                    color: selectedCustomer.risk === "high"
                      ? "#d86b70"
                      : selectedCustomer.risk === "medium"
                        ? "#d49a35"
                        : "#29966d",
                    background: selectedCustomer.risk === "high"
                      ? "rgba(216, 107, 112, 0.13)"
                      : selectedCustomer.risk === "medium"
                        ? "rgba(212, 154, 53, 0.13)"
                        : "rgba(41, 150, 109, 0.13)",
                    padding: "5px 12px",
                    borderRadius: 20,
                    display: "inline-block"
                  }}>
                    {riskLabel(selectedCustomer.risk, language)}
                  </strong>
                </div>
              </div>

              <div style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 10,
                background: "var(--hover-bg, rgba(100, 116, 139, 0.08))"
              }}>
                <p className="ci-footnote">{t.classificationReason}</p>
                <p>{translateBackendText(selectedCustomer.risk_reason || "Not specified", language)}</p>
              </div>

              <div style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 10,
                background: "var(--hover-bg, rgba(100, 116, 139, 0.08))"
              }}>
                <p className="ci-footnote">{t.recommendedAction}</p>
                <p>{translateBackendText(selectedCustomer.recommendation || t.noRecommendation, language)}</p>
              </div>

              {customer360Loading && (
                <p className="ci-footnote" style={{ marginTop: 18 }}>
                  {t.loadingCustomer360}
                </p>
              )}

              {customer360Error && (
                <p className="ci-error" style={{ marginTop: 18 }}>
                  {customer360Error}
                </p>
              )}

              {customer360 && (
                <div style={{ marginTop: 22, display: "grid", gap: 18 }}>
                  <section>
                    <h3>{t.customerProfile}</h3>
                    <div className="ci-detail-grid">
                      <div>
                        <p className="ci-footnote">{t.name}</p>
                        <strong>
                          {[customer360.customer.first_name, customer360.customer.last_name]
                            .filter(Boolean).join(" ") || t.notSpecified}
                        </strong>
                      </div>
                      <div>
                        <p className="ci-footnote">{t.customerType}</p>
                        <strong>{label(customer360.customer.customer_type, language)}</strong>
                      </div>
                      <div>
                        <p className="ci-footnote">{t.createdOn}</p>
                        <strong>
                          {customer360.customer.created_at
                            ? new Date(customer360.customer.created_at).toLocaleDateString(locale)
                            : t.notSpecified}
                        </strong>
                      </div>
                      <div>
                        <p className="ci-footnote">{t.branchId}</p>
                        <strong>{customer360.customer.branch_id ?? t.notSpecified}</strong>
                      </div>
                    </div>
                  </section>

                  <section className="c360-card">
                    <h3>{t.customerActivity}</h3>
                    <div className="c360-kpis">
                      <div className="c360-kpi">
                        <span className="c360-kpi-label">{t.transactions}</span>
                        <div className="c360-kpi-value">
                          {customer360.analytics?.transaction_count ?? customer360.transactions.length}
                        </div>
                      </div>
                      <div className="c360-kpi">
                        <span className="c360-kpi-label">{t.completed}</span>
                        <div className="c360-kpi-value">
                          {customer360.analytics?.completed_transactions ?? 0}
                        </div>
                      </div>
                      <div className="c360-kpi">
                        <span className="c360-kpi-label">{t.totalAccounts}</span>
                        <div className="c360-kpi-value">
                          {number(customer360.customer.active_accounts ?? customer360.accounts.length)}
                        </div>
                      </div>
                    </div>

                    <h4 style={{ marginTop: 20 }}>{t.transactionVolume}</h4>
                    <div className="c360-currency-grid">
                      {(customer360.analytics?.transaction_volume_by_currency ?? []).map((item) => (
                        <div className="c360-currency-item" key={item.currency}>
                          <span className="c360-kpi-label">{item.currency}</span>
                          <strong>{number(item.transaction_volume)} {item.currency}</strong>
                          <span className="c360-kpi-label">
                            {item.transaction_count} {t.transactionCountLabel}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="ci-footnote">
                      {t.volumeLatest20}
                    </p>
                  </section>

                  <section className="c360-card">
                    <h3>{t.accountsByCurrency}</h3>
                    <div className="c360-currency-grid">
                      {(customer360.analytics?.accounts_by_currency ?? []).map((item) => (
                        <div className="c360-currency-item" key={item.currency}>
                          <span className="c360-kpi-label">{item.currency}</span>
                          <strong>{item.account_count} {t.accounts}</strong>
                          <span className="c360-kpi-label">
                            {item.active_count} {t.active}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="c360-card">
                    <h3>{t.activityHistory}</h3>
                    {customer360.transactions.length === 0 ? (
                      <p>{t.noTransactionRecords}</p>
                    ) : (
                      <div className="c360-timeline">
                        {[...customer360.transactions]
                          .sort((a, b) =>
                            new Date(b.transaction_timestamp || 0) -
                            new Date(a.transaction_timestamp || 0)
                          )
                          .map((transaction) => (
                            <div className="c360-timeline-item" key={transaction.transaction_id}>
                              <div className="c360-timeline-content">
                                <div className="c360-timeline-top">
                                  <strong>{label(transaction.transaction_type, language)}</strong>
                                  <span className="c360-timeline-amount">
                                    {number(transaction.amount)} {transaction.currency}
                                  </span>
                                </div>
                                <p className="c360-timeline-meta">
                                  {transaction.transaction_timestamp
                                    ? new Date(transaction.transaction_timestamp).toLocaleString(locale)
                                    : t.unknownDate}
                                  {" · "}{label(transaction.transaction_status, language)}
                                  {" · "}{label(transaction.channel, language)}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </section>

                  <section>
                    <h3>{t.accountRecords}</h3>
                    {customer360.accounts.length === 0 ? (
                      <p>{t.noAccountRecords}</p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr>
                              {[t.accountId, t.accountType, t.currency, t.status].map((heading) => (
                                <th key={heading} style={{ textAlign: "left", padding: 10 }}>
                                  {heading}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {customer360.accounts.map((account) => (
                              <tr key={account.account_id}>
                                <td style={{ padding: 10 }}>{account.account_id}</td>
                                <td style={{ padding: 10 }}>{label(account.account_type, language)}</td>
                                <td style={{ padding: 10 }}>{account.currency}</td>
                                <td style={{ padding: 10 }}>{label(account.account_status, language)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <section>
                    <h3>{t.recentTransactions}</h3>
                    {customer360.transactions.length === 0 ? (
                      <p>{t.noRecentTransactionRecords}</p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr>
                              {[t.date, t.type, t.amount, t.status, t.channel].map((heading) => (
                                <th key={heading} style={{ textAlign: "left", padding: 10 }}>
                                  {heading}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {customer360.transactions.map((transaction) => (
                              <tr key={transaction.transaction_id}>
                                <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                                  {transaction.transaction_timestamp
                                    ? new Date(transaction.transaction_timestamp).toLocaleString(locale)
                                    : "–"}
                                </td>
                                <td style={{ padding: 10 }}>{label(transaction.transaction_type, language)}</td>
                                <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                                  {number(transaction.amount)} {transaction.currency}
                                </td>
                                <td style={{ padding: 10 }}>{label(transaction.transaction_status, language)}</td>
                                <td style={{ padding: 10 }}>{label(transaction.channel, language)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
              )}

              <p className="ci-footnote" style={{ marginTop: 18 }}>
                Synthetic demo record – not a real customer file.
              </p>
            </div>
          )}
        </section>
      )}

      {segmentationData && (
        <>
          <div className="charts-grid ci-charts-grid">
            {customerTypeChartData.length > 0 && (
              <Panel demoLabel={t.demo}
                title={t.customersByType}
                subtitle={t.individualCorporate}
              >
                <div className="ci-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customerTypeChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="customerType" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => number(value)} />
                      <Bar dataKey="total" name="Customers" fill="#527bd0" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}

            <Panel demoLabel={t.demo}
              title={t.customersByAge}
              subtitle={t.ageDistribution}
            >
              <div className="ci-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="ageGroup" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => number(value)} />
                    <Bar dataKey="total" name="Customers" fill="#29966d" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="ci-footnote">
                Age groups are derived from the dates of birth in the synthetic demo records.
              </p>
            </Panel>
          </div>

          {branchChartData.length > 0 && (
            <div className="charts-grid ci-charts-grid">
              <Panel demoLabel={t.demo}
                title={t.customersByBranch}
                subtitle={t.customersByBranchSubtitle}
              >
                <div className="ci-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchChartData} layout="vertical" margin={{ left: 12, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="branch" width={150} tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(value) => number(value)} />
                      <Bar dataKey="customers" name="Customers" fill="#b58a42" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>
          )}
        </>
      )}

      <div className="charts-grid ci-charts-grid">
        <Panel demoLabel={t.demo}
          title={t.customerGrowth}
          subtitle={t.newCustomersMonth}
        >
          <div className="ci-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => number(value)} />
                <Bar
                  dataKey="newCustomers"
                  name="New Customers"
                  fill="#527bd0"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel demoLabel={t.demo}
          title={t.customerStatus}
          subtitle={t.statusDistribution}
        >
          <div className="ci-status-list">
            {statusRows.map((row) => {
              const total = Number(row.total || 0);
              const percent = customers.total
                ? (total / customers.total) * 100
                : 0;
              return (
                <div className="ci-status-row" key={`${row.customer_status}-${row.synthetic_record ?? ""}`}>
                  <div className="ci-status-label">
                    <span
                      className="status-dot"
                      style={{ background: statusColors[row.customer_status] || "#8994a6" }}
                    />
                    <span>{label(row.customer_status, language)}</span>
                    <strong>{number(total)}</strong>
                  </div>
                  <div className="ci-progress">
                    <span
                      style={{
                        width: `${percent}%`,
                        background: statusColors[row.customer_status] || "#8994a6",
                      }}
                    />
                  </div>
                  <small>{percent.toFixed(1)} %</small>
                </div>
              );
            })}
          </div>
          <div className="ci-status-summary">
            <span>Inactive: {number(inactiveCustomers)}</span>
            <span>Blocked: {number(blockedCustomers)}</span>
          </div>
        </Panel>
      </div>

      <div className="charts-grid ci-charts-grid">
        <Panel demoLabel={t.demo}
          title={t.accountsTypeStatus}
          subtitle={t.accountsCurrencyNote}
        >
          <div className="ci-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={accountChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="accountType" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => number(value)} />
                <Legend />
                {accountStatuses.map((status) => (
                  <Bar
                    key={status}
                    dataKey={status}
                    name={label(status, language)}
                    stackId="accounts"
                    fill={statusColors[status] || "#527bd0"}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="ci-footnote">
            The chart shows account counts across all currencies, not summed monetary amounts.
          </p>
        </Panel>

        <Panel demoLabel={t.demo}
          title={t.transactionsTypeStatus}
          subtitle={t.transactionCount}
        >
          <div className="ci-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={transactionChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="transactionType" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => number(value)} />
                <Legend />
                {transactionStatuses.map((status) => (
                  <Bar
                    key={status}
                    dataKey={status}
                    name={label(status, language)}
                    stackId="transactions"
                    fill={statusColors[status] || "#527bd0"}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="ci-footnote">
            {t.chartTransactionNote}
          </p>
        </Panel>
      </div>

      <div className="ci-data-footer">
        {t.dataSource}: {bank} · {t.apiCustomerIntelligence} · {footnote}
      </div>
    </div>
  );
}
