import { useEffect, useMemo, useState } from "react";
import "./ChurnPrevention.css";
import { translations } from "./translations";

const statusLabels = {
  "Offen": "Open",
  "Kontakt aufgenommen": "Contact Initiated",
  "Kunde interessiert": "Customer Engaged",
  "Erfolgreich zurückgewonnen": "Successfully Retained",
  "Nicht zurückgewonnen": "Retention Unsuccessful",
};

const riskLabel = { high: "High", medium: "Medium", low: "Low" };
const priorityLabel = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const priorityOptions = ["critical", "high", "medium", "low"];
const statusOptions = Object.keys(statusLabels);
const actionOptions = [
  "Persönlicher Anruf",
  "Beratungsgespräch",
  "Individuelles Angebot",
  "Gebühren- oder Konditionenprüfung",
  "Kundenstatus prüfen",
  "Weitere Action",
];
const teamOptions = [
  "Customer Relationship Management",
  "Retail Banking & Advisory",
  "Pricing & Product Management",
  "Customer Operations",
  "Retention Management",
];

function formatComparison(item, period, t) {
  if (!item) return t.comparisonUnavailable;
  const change = Number(item.change || 0);
  const previous = { daily: t.previousDay, weekly: t.previousWeek, monthly: t.previousMonth }[period];
  if (!change) return `${t.noChange} vs ${previous}`;
  const sign = change > 0 ? "+" : "";
  const percentage = item.change_percent == null ? "" : ` (${item.change_percent > 0 ? "+" : ""}${item.change_percent}%)`;
  return `${sign}${change}${percentage} vs ${previous}`;
}

function translateRecommendation(value, language) {
  if (!value) return value;

  const labels = {
    "Kunde war kürzlich aktiv": {
      en: "Customer was recently active",
      fr: "Le client a été actif récemment",
    },
    "Kundenbindung weiter stärken": {
      en: "Continue strengthening customer engagement",
      fr: "Continuer à renforcer la fidélisation du client",
    },
    "Contact the customer and present a tailored offer": {
      en: "Contact the customer and present a tailored offer",
      fr: "Contacter le client et lui présenter une offre personnalisée",
    },
    "Initiate a personalized retention intervention": {
      en: "Initiate a personalized retention intervention",
      fr: "Lancer une action de fidélisation personnalisée",
    },
  };

  if (labels[value]) return labels[value][language] || labels[value].en;

  const inactiveMatch = value.match(/^No successful transaction in the last (\d+) days$/);
  if (inactiveMatch) {
    const days = inactiveMatch[1];
    return language === "fr"
      ? `Aucune transaction réussie au cours des ${days} derniers jours`
      : `No successful transaction in the last ${days} days`;
  }

  return value;
}

function ChurnPrevention({ churnData, loading, error, language = "en" }) {
  const t = translations[language] || translations.en;
  const [records, setRecords] = useState({});
  const [selectedId, setSelectedId] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("high");
  const [statusFilter, setStatusFilter] = useState("all");
  const [engagementFilter, setEngagementFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [retentionPeriod, setRetentionPeriod] = useState("daily");
  const [actionsLoading, setActionsLoading] = useState(true);
  const [actionsError, setActionsError] = useState("");
  const [reportError, setReportError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingContact, setIsLoggingContact] = useState(false);
  const [activityReport, setActivityReport] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadActions() {
      try {
        const response = await fetch("/data/churn-prevention.json");
        if (!response.ok) {
          throw new Error("Churn Prevention demo data could not be loaded.");
        }

        const jsonData = await response.json();
        const loadedRecords = {};

        for (const action of jsonData.actions || []) {
          loadedRecords[action.customer_id] = {
            action: action.action || "",
            status: action.status || "Offen",
            followUpDate: action.follow_up_date || "",
            notes: action.notes || "",
            assignedTeam: action.assigned_team || "",
            assignedEmployee: action.assigned_employee || "",
          };
        }

        if (!cancelled) setRecords(loadedRecords);
      } catch (err) {
        if (!cancelled) setActionsError(err.message || "Demo data could not be loaded.");
      } finally {
        if (!cancelled) setActionsLoading(false);
      }
    }

    loadActions();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPerformance() {
      try {
        setReportError("");
        const response = await fetch(`/data/retention-${retentionPeriod}.json`);

        if (!response.ok) {
          throw new Error("Retention performance demo data could not be loaded.");
        }

        const data = await response.json();
        if (!cancelled) setActivityReport(data);
      } catch (err) {
        if (!cancelled) setReportError(err.message || "Report data could not be loaded.");
      }
    }

    loadPerformance();
    return () => { cancelled = true; };
  }, [retentionPeriod]);

  const customers = churnData?.customers || [];

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const record = records[customer.customer_id] || {};
      const priority = record.retentionPriority || customer.retention_priority;
      return (
        String(customer.customer_id).toLowerCase().includes(search.trim().toLowerCase()) &&
        (riskFilter === "all" || customer.risk === riskFilter) &&
        (statusFilter === "all" || (record.status || "Offen") === statusFilter) &&
        (engagementFilter === "all" || customer.engagement_segment === engagementFilter) &&
        (priorityFilter === "all" || priority === priorityFilter)
      );
    }).sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityA = records[a.customer_id]?.retentionPriority || a.retention_priority;
      const priorityB = records[b.customer_id]?.retentionPriority || b.retention_priority;
      return (order[priorityA] ?? 4) - (order[priorityB] ?? 4);
    });
  }, [customers, records, search, riskFilter, statusFilter, engagementFilter, priorityFilter]);

  const selectedCustomer = customers.find((customer) => customer.customer_id === selectedId);
  const selectedRecord = selectedId ? (records[selectedId] || {}) : {};

  function updateSelectedRecord(field, value) {
    if (!selectedId) return;
    setSaveMessage("");
    setRecords((current) => ({
      ...current,
      [selectedId]: {
        ...(current[selectedId] || {}),
        [field]: value,
      },
    }));
  }

  function saveSelectedRecord() {
    if (!selectedId || !selectedRecord.action?.trim()) {
      setSaveMessage(t.selectAction);
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    // Demo: Änderungen bleiben nur im React-Zustand und werden
    // beim Neuladen der Seite automatisch zurückgesetzt.
    setRecords((current) => ({
      ...current,
      [selectedId]: { ...selectedRecord },
    }));

    setSaveMessage(
      language === "fr"
        ? "Modifications enregistrées dans cette démo (non permanentes)."
        : "Changes saved in this demo (not permanent)."
    );
    setIsSaving(false);
  }

  function logCustomerContact() {
    if (!selectedId) return;

    const record = records[selectedId] || {};
    if (!record.action?.trim()) {
      setSaveMessage(t.selectAction);
      return;
    }

    setIsLoggingContact(true);
    setSaveMessage("");

    const nextStatus = record.status === "Offen" || !record.status
      ? "Kontakt aufgenommen"
      : record.status;

    setRecords((current) => ({
      ...current,
      [selectedId]: {
        ...record,
        status: nextStatus,
      },
    }));

    // Die Kontaktzahl wird nur in der aktuellen Demo-Sitzung erhöht.
    setActivityReport((current) => {
      if (!current) return current;

      return {
        ...current,
        totals: {
          ...current.totals,
          total_events: (Number(current.totals?.total_events) || 0) + 1,
          customer_contacts: (Number(current.totals?.customer_contacts) || 0) + 1,
        },
      };
    });

    setSaveMessage(
      language === "fr"
        ? "Contact client simulé dans cette démo."
        : "Customer contact simulated in this demo."
    );
    setIsLoggingContact(false);
  }

  const counts = {
    high: customers.filter((c) => c.risk === "high").length,
    medium: customers.filter((c) => c.risk === "medium").length,
    low: customers.filter((c) => c.risk === "low").length,
    critical: customers.filter((c) => (records[c.customer_id]?.retentionPriority || c.retention_priority) === "critical").length,
    engagementHigh: customers.filter((c) => c.engagement_segment === "high").length,
    engagementMedium: customers.filter((c) => c.engagement_segment === "medium").length,
    engagementLow: customers.filter((c) => c.engagement_segment === "low").length,
    open: Object.values(records).filter((r) => !r.status || r.status === "Offen").length,
    contacted: Object.values(records).filter((r) => ["Kontakt aufgenommen", "Kunde interessiert"].includes(r.status)).length,
    recovered: Object.values(records).filter((r) => r.status === "Erfolgreich zurückgewonnen").length,
  };

  if (loading || actionsLoading) {
    return <div className="cp-message">{t.loadingChurn}</div>;
  }

  if (error) return <div className="cp-message cp-error">{error}</div>;
  if (actionsError) return <div className="cp-message cp-error">{actionsError}</div>;

  const report = activityReport;
  const visibleCustomers = filteredCustomers.slice(0, 200);

  return (
    <div className="cp-page">
      <div className="cp-notice">
        <strong>{t.interactiveDemo}</strong>
        <span>
          {t.churnDemoNotice}
        </span>
      </div>

      <div className="cp-summary">
        <article className="cp-metric cp-high"><span>{t.highRiskCustomers}</span><strong>{counts.high}</strong></article>
        <article className="cp-metric cp-open"><span>{t.openActions}</span><strong>{counts.open}</strong></article>
        <article className="cp-metric cp-contact"><span>{t.contactedInterested}</span><strong>{counts.contacted}</strong></article>
        <article className="cp-metric cp-success"><span>{t.retained}</span><strong>{counts.recovered}</strong></article>
        <article className="cp-metric cp-critical"><span>{t.criticalRetention}</span><strong>{counts.critical}</strong></article>
        <article className="cp-metric cp-engagement-high"><span>{t.highEngagement}</span><strong>{counts.engagementHigh}</strong></article>
        <article className="cp-metric cp-engagement-medium"><span>{t.mediumEngagement}</span><strong>{counts.engagementMedium}</strong></article>
        <article className="cp-metric cp-engagement-low"><span>{t.lowEngagement}</span><strong>{counts.engagementLow}</strong></article>
      </div>

      <section className="cp-panel cp-effectiveness">
        <div className="cp-heading">
          <div>
            <h2>{t.retentionEffectiveness}</h2>
            <p>{t.activityRecorded}</p>
          </div>
          <label className="cp-period-select">
            {t.reportingPeriod}
            <select value={retentionPeriod} onChange={(event) => setRetentionPeriod(event.target.value)}>
              <option value="daily">{t.daily}</option>
              <option value="weekly">{t.weekly}</option>
              <option value="monthly">{t.monthly}</option>
            </select>
          </label>
        </div>

        <h3 className="cp-report-subtitle">{t[retentionPeriod]} {t.activity}</h3>
        {reportError && <p className="cp-effectiveness-note">{reportError}</p>}

        <div className="cp-effectiveness-grid">
          {[
            [t.actionsUpdated, "actions_created", t.actionsUpdatedNote],
            [t.customerContacts, "customer_contacts", t.customerContactsNote],
            [t.successfulChanges, "successful_outcomes", t.successfulChangesNote],
            [t.unsuccessfulChanges, "unsuccessful_outcomes", t.unsuccessfulChangesNote],
          ].map(([label, key, description]) => (
            <article className="cp-effectiveness-card" key={key}>
              <span>{label}</span>
              <strong>{report?.totals?.[key] ?? "—"}</strong>
              <small>{description}</small>
              <small className="cp-comparison">{formatComparison(report?.comparison?.[key], retentionPeriod, t)}</small>
            </article>
          ))}
        </div>

        <h3 className="cp-report-subtitle">{t.teamPerformance}</h3>
        {report?.team_performance?.length ? (
          <div className="cp-team-report">
            <div className="cp-team-report-row cp-team-report-header">
              <span>{t.responsibleTeam}</span><span>{t.events}</span><span>{t.contacts}</span><span>{t.successful}</span>
            </div>
            {report.team_performance.map((team) => (
              <div className="cp-team-report-row" key={team.team_name}>
                <span>{team.team_name}</span>
                <span>{team.recorded_events}</span>
                <span>{team.customer_contacts}</span>
                <span>{team.successful_outcomes}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="cp-effectiveness-note">{t.noTeamActivity}</p>
        )}
        <p className="cp-effectiveness-note">{t.activityReportNote}</p>
      </section>

      <section className="cp-panel">
        <div className="cp-heading">
          <div>
            <h2>{t.prioritizedCustomers}</h2>
            <p>Sedad Bank · {filteredCustomers.length.toLocaleString()} {t.matchingCustomers}</p>
          </div>
        </div>

        <details className="cp-priority-guide">
          <summary>{t.howPrioritiesCalculated}</summary>
          <div className="cp-guide-content">
            <p>{t.priorityExplanation}</p>

            <h3>1. {t.engagementScore}</h3>
            <div className="cp-guide-grid">
              <div>
                <strong>{t.recency}</strong>
                <ul>
                  <li>{t.recency40}</li>
                  <li>{t.recency30}</li>
                  <li>{t.recency15}</li>
                  <li>{t.recency0}</li>
                </ul>
              </div>
              <div>
                <strong>{t.frequency}</strong>
                <ul>
                  <li>{t.frequency40}</li>
                  <li>{t.frequency30}</li>
                  <li>{t.frequency20}</li>
                  <li>{t.frequency0}</li>
                </ul>
              </div>
              <div>
                <strong>{t.activeAccountsScore}</strong>
                <ul>
                  <li>{t.accounts20}</li>
                  <li>{t.accounts15}</li>
                  <li>{t.accounts0}</li>
                </ul>
              </div>
            </div>

            <p className="cp-guide-note">{t.scoreTotal}</p>

            <h3>2. {t.priorityMatrix}</h3>
            <p className="cp-guide-note">
              {t.matrixExplanation}
            </p>
            <div className="cp-guide-table-wrap">
              <table className="cp-guide-table">
                <thead>
                  <tr>
                    <th>{t.riskLabel}</th>
                    <th>{t.highEngagement}</th>
                    <th>{t.mediumEngagement}</th>
                    <th>{t.lowEngagement}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><th>{t.highRisk}</th><td>{t.critical}</td><td>{t.high}</td><td>{t.medium}</td></tr>
                  <tr><th>{t.mediumRisk}</th><td>{t.high}</td><td>{t.medium}</td><td>{t.medium}</td></tr>
                  <tr><th>{t.lowRisk}</th><td>{t.low}</td><td>{t.low}</td><td>{t.low}</td></tr>
                </tbody>
              </table>
            </div>

            <h3>3. {t.howInterpret}</h3>
            <ul>
              <li><strong>{t.critical}:</strong> {t.criticalMeaning}</li>
              <li><strong>{t.high}:</strong> {t.highMeaning}</li>
              <li><strong>{t.medium}:</strong> {t.mediumMeaning}</li>
              <li><strong>{t.low}:</strong> {t.lowMeaning}</li>
            </ul>

            <p className="cp-guide-note">{t.ruleBasedNote}</p>
          </div>
        </details>

        <div className="cp-filters">
          <input type="search" placeholder={t.searchCustomer} value={search} onChange={(event) => setSearch(event.target.value)} />
          <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
            <option value="all">{t.allRisk}</option><option value="high">{t.highRisk}</option><option value="medium">{t.mediumRisk}</option><option value="low">{t.lowRisk}</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">{t.allStatuses}</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={engagementFilter} onChange={(event) => setEngagementFilter(event.target.value)}>
            <option value="all">{t.allSegments}</option><option value="high">{t.highEngagement}</option><option value="medium">{t.mediumEngagement}</option><option value="low">{t.lowEngagement}</option>
          </select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="all">{t.allPriorities}</option><option value="critical">{t.critical}</option><option value="high">{t.high}</option><option value="medium">{t.medium}</option><option value="low">{t.low}</option>
          </select>
        </div>

        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>{t.customerId}</th><th>{t.riskLabel}</th><th>{t.engagement}</th><th>{t.customerType}</th><th>{t.retentionPriority}</th><th>{t.inactiveFor}</th><th>{t.recommendation}</th><th>{t.processingStatus}</th><th>{t.action}</th>
              </tr>
            </thead>
            <tbody>
              {visibleCustomers.map((customer) => {
                const record = records[customer.customer_id] || {};
                const priority = record.retentionPriority || customer.retention_priority;
                return (
                  <tr
                    key={customer.customer_id}
                    className={selectedId === customer.customer_id ? "cp-selected-row" : "cp-clickable-row"}
                    onClick={() => { setSelectedId(customer.customer_id); setSaveMessage(""); }}
                    title={t.viewCustomer}
                  >
                    <td className="cp-id">{customer.customer_id}</td>
                    <td><span className={`cp-risk cp-risk-${customer.risk}`}>{t[customer.risk] || customer.risk}</span></td>
                    <td><strong>{customer.engagement_score ?? 0}</strong><span className="cp-score-max"> / 100</span></td>
                    <td><span className={`cp-segment cp-segment-${customer.engagement_segment || "low"}`}>{t[customer.engagement_segment] || t.noData}</span></td>
                    <td><span className={`cp-priority cp-priority-${priority || "low"}`}>{t[priority] || t.noData}</span></td>
                    <td>{customer.days_inactive == null ? t.noSuccessfulTransaction : `${customer.days_inactive} ${t.days}`}</td>
                    <td className="cp-recommendation">{translateRecommendation(record.recommendation || customer.recommendation || customer.risk_reason || "–", language)}</td>
                    <td><span className="cp-status">{({ "Offen": t.riskOpen, "Kontakt aufgenommen": t.contactInitiated, "Kunde interessiert": t.customerEngaged, "Erfolgreich zurückgewonnen": t.successfullyRetained, "Nicht zurückgewonnen": t.retentionUnsuccessful })[record.status || "Offen"] || t.riskOpen}</span></td>
                    <td>
                      <button
                        type="button"
                        className="cp-edit-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(customer.customer_id);
                          setSaveMessage("");
                        }}
                      >
                        {t.edit}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibleCustomers.length === 0 && <tr><td colSpan="9" className="cp-empty">{t.noMatches}</td></tr>}
            </tbody>
          </table>
        </div>
        {filteredCustomers.length > visibleCustomers.length && (
          <p className="cp-effectiveness-note">
            {t.showingFirst} {visibleCustomers.length} {t.showingCustomers} {filteredCustomers.length.toLocaleString()} {t.matchingCustomers} {t.useFilters}
          </p>
        )}
      </section>

      {selectedCustomer && (
        <section className="cp-panel cp-editor">
          <div className="cp-heading">
            <div>
              <h2>{t.editAction}</h2>
              <p>{selectedCustomer.first_name || ""} {selectedCustomer.last_name || ""} · {selectedCustomer.customer_id}</p>
            </div>
            <button type="button" className="cp-close-editor" onClick={() => setSelectedId("")}>{t.close}</button>
          </div>

          <div className="cp-customer-info">
            <span>{t.riskLabel}: <strong>{t[selectedCustomer.risk] || selectedCustomer.risk}</strong></span>
            <span>{t.inactiveFor}: <strong>{selectedCustomer.days_inactive == null ? "—" : `${selectedCustomer.days_inactive} ${t.days}`}</strong></span>
            <span>{t.engagement}: <strong>{t[selectedCustomer.engagement_segment] || "—"}</strong></span>
          </div>

          <div className="cp-form-grid">
            <div className="cp-readonly-field">
              <span>{t.retentionPriority}</span>
              <strong>
                {t[selectedCustomer.retention_priority] || selectedCustomer.retention_priority || "—"}
              </strong>
            </div>

            <div className="cp-readonly-field">
              <span>{t.recommendation}</span>
              <p>{selectedCustomer.recommendation || selectedCustomer.risk_reason || "—"}</p>
            </div>

            <label>
              {t.action}
              <select value={selectedRecord.action || ""}
                onChange={(e) => updateSelectedRecord("action", e.target.value)}>
                <option value="">{t.selectAction}</option>
                {actionOptions.map((value) => {
                  const labels = {
                    "Persönlicher Anruf": t.personalCall,
                    "Beratungsgespräch": t.consultation,
                    "Individuelles Angebot": t.individualOffer,
                    "Gebühren- oder Konditionenprüfung": t.feeReview,
                    "Kundenstatus prüfen": t.checkCustomerStatus,
                    "Weitere Action": t.otherAction,
                  };
                  return <option key={value} value={value}>{labels[value] || value}</option>;
                })}
              </select>
            </label>

            <label>
              {t.responsibleTeam}
              <select value={selectedRecord.assignedTeam || ""}
                onChange={(e) => updateSelectedRecord("assignedTeam", e.target.value)}>
                <option value="">{t.selectTeam}</option>
                {teamOptions.map((value) => {
                  const labels = {
                    "Customer Relationship Management": t.crmTeam,
                    "Retail Banking & Advisory": t.retailTeam,
                    "Pricing & Product Management": t.pricingTeam,
                    "Customer Operations": t.operationsTeam,
                    "Retention Management": t.retentionTeam,
                  };
                  return <option key={value} value={value}>{labels[value] || value}</option>;
                })}
              </select>
            </label>

            <label>
              {t.assignedEmployee}
              <input value={selectedRecord.assignedEmployee || ""}
                onChange={(e) => updateSelectedRecord("assignedEmployee", e.target.value)}
                placeholder={t.employeeName} />
            </label>

            <label>
              {t.processingStatus}
              <select value={selectedRecord.status || "Offen"}
                onChange={(e) => updateSelectedRecord("status", e.target.value)}>
                {statusOptions.map((value) => {
                  const labels = {
                    "Offen": t.riskOpen,
                    "Kontakt aufgenommen": t.contactInitiated,
                    "Kunde interessiert": t.customerEngaged,
                    "Erfolgreich zurückgewonnen": t.successfullyRetained,
                    "Nicht zurückgewonnen": t.retentionUnsuccessful,
                  };
                  return <option key={value} value={value}>{labels[value] || statusLabels[value]}</option>;
                })}
              </select>
            </label>

            <label>
              {t.nextFollowUp}
              <input type="date" value={selectedRecord.followUpDate || ""}
                onChange={(e) => updateSelectedRecord("followUpDate", e.target.value)} />
            </label>

            <label className="cp-notes">
              {t.actionNotes}
              <textarea rows="3" value={selectedRecord.notes || ""}
                onChange={(e) => updateSelectedRecord("notes", e.target.value)}
                placeholder={t.addNotes} />
            </label>
          </div>

          <div className="cp-editor-actions">
            <button type="button" className="cp-save-button" onClick={saveSelectedRecord} disabled={isSaving || isLoggingContact}>
              {isSaving ? t.saving : (language === "fr" ? "Enregistrer la démo" : "Save demo changes")}
            </button>
            <button type="button" className="cp-contact-button" onClick={logCustomerContact} disabled={isSaving || isLoggingContact}>
              {isLoggingContact ? t.saving : (language === "fr" ? "Simuler un contact client" : "Simulate customer contact")}
            </button>
            {saveMessage && <span className="cp-saved">{saveMessage}</span>}
          </div>
        </section>
      )}
    </div>
  );
}

export default ChurnPrevention;
