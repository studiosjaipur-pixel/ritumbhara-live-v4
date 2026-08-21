// Backend: n8n webhook -> stores in the "Website Leads" n8n data table
// (workflow: Ritumbhara Website Lead Capture, project: Shivam Lohiya personal).
// INTERIM: n8n workspace is deactivated (webhook unreachable), so this is
// pointed at Formspree until n8n is restored.
// TO REVERT: uncomment the n8n line below and delete/comment the Formspree line.
// export const LEAD_CAPTURE_ENDPOINT = "https://ritumbhara.app.n8n.cloud/webhook/ritumbhara-lead-capture";
export const LEAD_CAPTURE_ENDPOINT = "https://formspree.io/f/mljrzaao";
