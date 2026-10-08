// Separate fixture services can exercise real flows without shared data or SMTP.
export const TEST_API_ORIGIN =
  process.env.SANGAI_TEST_API_URL || "http://localhost:4100";
export const TEST_MAIL_ORIGIN =
  process.env.SANGAI_TEST_MAIL_URL || "http://localhost:8025";
