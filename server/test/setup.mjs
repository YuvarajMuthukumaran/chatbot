// Loaded before every test file (npm test uses --import). The older booking tests book the real
// doctors' names at 10:00, which real OPD timings (schedules.js) would now rightly refuse, so they run
// with timings off. schedules.test.mjs turns them back on to test them.
process.env.OPD_SCHEDULES = "off";
// The chat booking flow e-mails a verification code; in test mode the code is shown in the reply
// (never in production), so the tests can complete a booking.
process.env.OTP_DEV_ECHO = "true";
