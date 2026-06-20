export const fakeStats = {
  dataset_id: "ds_001",
  total_accounts: 200,
  total_transactions: 2500,
  total_amount: 184920500.0,
  high_risk_accounts: 18,
  amount_flagged: 12840000.0,
  alerts_by_type: { circular: 2, layering: 3, smurfing: 1, rapid_movement: 4, fan_in: 1, fan_out: 0 },
  top_risk_accounts: [
    { account_id: "acc_0042", name: "Quikfix Traders", risk_score: 96, risk_level: "critical" },
    { account_id: "acc_0118", name: "Neel Sharma", risk_score: 91, risk_level: "critical" },
    { account_id: "acc_0091", name: "Maya Holdings", risk_score: 74, risk_level: "high" },
    { account_id: "acc_0203", name: "R. Khan", risk_score: 68, risk_level: "medium" },
    { account_id: "acc_0150", name: "Anita Rao", risk_score: 22, risk_level: "low" },
  ],
};

export const fakeGraph = {
  center_id: "acc_0042",
  nodes: [
    { id: "acc_0042", label: "Quikfix Traders", account_type: "shell", risk_score: 96, risk_level: "critical", is_center: true, flagged: true },
    { id: "acc_0118", label: "Neel Sharma", account_type: "individual", risk_score: 91, risk_level: "critical", is_center: false, flagged: true },
    { id: "acc_0091", label: "Maya Holdings", account_type: "business", risk_score: 74, risk_level: "high", is_center: false, flagged: true },
    { id: "acc_0203", label: "R. Khan", account_type: "individual", risk_score: 68, risk_level: "medium", is_center: false, flagged: true },
    { id: "acc_0150", label: "Anita Rao", account_type: "individual", risk_score: 22, risk_level: "low", is_center: false, flagged: false },
    { id: "acc_0312", label: "Global Import LLC", account_type: "business", risk_score: 15, risk_level: "low", is_center: false, flagged: false },
  ],
  edges: [
    { id: "e1", source: "acc_0042", target: "acc_0118", amount: 1850000.0, txn_count: 6, last_timestamp: "2026-02-15T11:20:00Z", suspicious: true },
    { id: "e2", source: "acc_0118", target: "acc_0091", amount: 1700000.0, txn_count: 4, last_timestamp: "2026-02-15T18:00:00Z", suspicious: true },
    { id: "e3", source: "acc_0091", target: "acc_0203", amount: 1650000.0, txn_count: 3, last_timestamp: "2026-02-16T02:10:00Z", suspicious: true },
    { id: "e4", source: "acc_0203", target: "acc_0042", amount: 1600000.0, txn_count: 2, last_timestamp: "2026-02-16T04:40:00Z", suspicious: true },
    { id: "e5", source: "acc_0150", target: "acc_0042", amount: 30000.0, txn_count: 1, last_timestamp: "2026-02-12T10:00:00Z", suspicious: false },
    { id: "e6", source: "acc_0042", target: "acc_0312", amount: 45000.0, txn_count: 2, last_timestamp: "2026-02-13T14:15:00Z", suspicious: false },
  ],
};

export const fakeAccount = {
  account_id: "acc_0042",
  name: "Quikfix Traders",
  account_type: "shell",
  risk_score: 96,
  risk_level: "critical",
  flags: ["circular", "rapid_movement"],
  total_in: 4200000.0,
  total_out: 4180000.0,
  txn_count: 37,
  fan_in: 9,
  fan_out: 11,
  explanation: [
    { factor: "Rapid pass-through", detail: "98% of funds left within 24h of arrival", contribution: 34 },
    { factor: "Circular flow", detail: "Member of a 4-account loop returning funds to origin", contribution: 28 },
    { factor: "Structuring", detail: "14 deposits just under the 50,000 reporting threshold", contribution: 21 },
    { factor: "Shell signature", detail: "No salary/utility transactions; pure transfer activity", contribution: 13 },
  ],
  top_counterparties: [
    { account_id: "acc_0118", name: "Neel Sharma", amount: 1850000.0, direction: "out" },
    { account_id: "acc_0091", name: "Maya Holdings", amount: 1200000.0, direction: "in" },
  ],
  timeline: [
    { timestamp: "2026-02-14T08:31:00Z", amount: 49000.0, direction: "in", counterparty_id: "acc_0091" },
    { timestamp: "2026-02-14T09:02:00Z", amount: 48500.0, direction: "out", counterparty_id: "acc_0118" },
    { timestamp: "2026-02-14T11:15:00Z", amount: 45000.0, direction: "in", counterparty_id: "acc_0091" },
    { timestamp: "2026-02-14T12:00:00Z", amount: 47000.0, direction: "out", counterparty_id: "acc_0118" },
    { timestamp: "2026-02-15T02:30:00Z", amount: 350000.0, direction: "in", counterparty_id: "acc_0091" },
    { timestamp: "2026-02-15T05:00:00Z", amount: 340000.0, direction: "out", counterparty_id: "acc_0118" },
  ],
};

export const fakeAccountsList = [
  { account_id: "acc_0042", name: "Quikfix Traders", account_type: "shell", risk_score: 96, risk_level: "critical", flags: ["circular", "rapid_movement"], total_in: 4200000.0, total_out: 4180000.0, txn_count: 37 },
  { account_id: "acc_0118", name: "Neel Sharma", account_type: "individual", risk_score: 91, risk_level: "critical", flags: ["circular"], total_in: 1900000.0, total_out: 1850000.0, txn_count: 14 },
  { account_id: "acc_0091", name: "Maya Holdings", account_type: "business", risk_score: 74, risk_level: "high", flags: ["layering"], total_in: 5600000.0, total_out: 5300000.0, txn_count: 29 },
  { account_id: "acc_0203", name: "R. Khan", account_type: "individual", risk_score: 68, risk_level: "medium", flags: ["rapid_movement"], total_in: 1650000.0, total_out: 1600000.0, txn_count: 8 },
  { account_id: "acc_0150", name: "Anita Rao", account_type: "individual", risk_score: 22, risk_level: "low", flags: [], total_in: 120000.0, total_out: 90000.0, txn_count: 5 },
  { account_id: "acc_0312", name: "Global Import LLC", account_type: "business", risk_score: 15, risk_level: "low", flags: [], total_in: 850000.0, total_out: 800000.0, txn_count: 12 },
];

export const fakeAlerts = [
  {
    alert_id: "alert_07",
    pattern_type: "circular",
    title: "4-account laundering loop",
    severity: 94,
    risk_level: "critical",
    account_ids: ["acc_0042", "acc_0118", "acc_0091", "acc_0203"],
    amount_involved: 6300000.0,
    summary: "63L cycled through 4 accounts returning 99% to the origin within 36 hours.",
    detected_at: "2026-02-16T05:00:00Z",
    narrative: "Funds originated at Quikfix Traders (acc_0042), moved to Neel Sharma, then Maya Holdings, then acc_0203, and returned to Quikfix - a closed loop with no economic purpose, a classic layering signature.",
    accounts: [
      { account_id: "acc_0042", name: "Quikfix Traders", risk_score: 96, risk_level: "critical", role: "origin" },
      { account_id: "acc_0118", name: "Neel Sharma", risk_score: 91, risk_level: "critical", role: "mule" },
      { account_id: "acc_0091", name: "Maya Holdings", risk_score: 74, risk_level: "high", role: "mule" },
      { account_id: "acc_0203", name: "R. Khan", risk_score: 68, risk_level: "medium", role: "beneficiary" },
    ],
    graph: {
      center_id: "acc_0042",
      nodes: [
        { id: "acc_0042", label: "Quikfix Traders", account_type: "shell", risk_score: 96, risk_level: "critical", is_center: true, flagged: true },
        { id: "acc_0118", label: "Neel Sharma", account_type: "individual", risk_score: 91, risk_level: "critical", is_center: false, flagged: true },
        { id: "acc_0091", label: "Maya Holdings", account_type: "business", risk_score: 74, risk_level: "high", is_center: false, flagged: true },
        { id: "acc_0203", label: "R. Khan", account_type: "individual", risk_score: 68, risk_level: "medium", is_center: false, flagged: true },
      ],
      edges: [
        { id: "e1", source: "acc_0042", target: "acc_0118", amount: 1850000.0, txn_count: 6, last_timestamp: "2026-02-15T11:20:00Z", suspicious: true },
        { id: "e2", source: "acc_0118", target: "acc_0091", amount: 1700000.0, txn_count: 4, last_timestamp: "2026-02-15T18:00:00Z", suspicious: true },
        { id: "e3", source: "acc_0091", target: "acc_0203", amount: 1650000.0, txn_count: 3, last_timestamp: "2026-02-16T02:10:00Z", suspicious: true },
        { id: "e4", source: "acc_0203", target: "acc_0042", amount: 1600000.0, txn_count: 2, last_timestamp: "2026-02-16T04:40:00Z", suspicious: true },
      ]
    }
  },
  {
    alert_id: "alert_08",
    pattern_type: "layering",
    title: "High-volume layering transfer",
    severity: 85,
    risk_level: "high",
    account_ids: ["acc_0091", "acc_0118"],
    amount_involved: 3500000.0,
    summary: "Rapid structured transfers between business entity and individual.",
    detected_at: "2026-02-15T18:30:00Z",
    narrative: "Structuring pattern detected. Large sums routed to intermediate accounts and dispersed immediately.",
    accounts: [
      { account_id: "acc_0091", name: "Maya Holdings", risk_score: 74, risk_level: "high", role: "origin" },
      { account_id: "acc_0118", name: "Neel Sharma", risk_score: 91, risk_level: "critical", role: "intermediary" },
    ],
    graph: {
      center_id: "acc_0091",
      nodes: [
        { id: "acc_0091", label: "Maya Holdings", account_type: "business", risk_score: 74, risk_level: "high", is_center: true, flagged: true },
        { id: "acc_0118", label: "Neel Sharma", account_type: "individual", risk_score: 91, risk_level: "critical", is_center: false, flagged: true },
      ],
      edges: [
        { id: "e2", source: "acc_0118", target: "acc_0091", amount: 1700000.0, txn_count: 4, last_timestamp: "2026-02-15T18:00:00Z", suspicious: true },
      ]
    }
  },
  {
    alert_id: "alert_09",
    pattern_type: "smurfing",
    title: "Micro-transfer smurfing deposit",
    severity: 78,
    risk_level: "high",
    account_ids: ["acc_0042", "acc_0150"],
    amount_involved: 48000.0,
    summary: "Multiple small deposits just below reporting thresholds.",
    detected_at: "2026-02-14T08:31:00Z",
    narrative: "Deposits structured below limits designed to trigger regulatory alerts.",
    accounts: [
      { account_id: "acc_0150", name: "Anita Rao", risk_score: 22, risk_level: "low", role: "smurf_node" },
      { account_id: "acc_0042", name: "Quikfix Traders", risk_score: 96, risk_level: "critical", role: "destination" },
    ],
    graph: {
      center_id: "acc_0042",
      nodes: [
        { id: "acc_0042", label: "Quikfix Traders", account_type: "shell", risk_score: 96, risk_level: "critical", is_center: true, flagged: true },
        { id: "acc_0150", label: "Anita Rao", account_type: "individual", risk_score: 22, risk_level: "low", is_center: false, flagged: false },
      ],
      edges: [
        { id: "e5", source: "acc_0150", target: "acc_0042", amount: 30000.0, txn_count: 1, last_timestamp: "2026-02-12T10:00:00Z", suspicious: false },
      ]
    }
  }
];
