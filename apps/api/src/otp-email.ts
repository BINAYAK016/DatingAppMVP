export type OtpEmailPurpose = "verify" | "reset";

/** Self-contained email: no remote images, tracking or private profile details. */
export function otpEmail(purpose: OtpEmailPurpose, code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error("An OTP must contain six digits.");
  const verification = purpose === "verify";
  const heading = verification ? "Verify your email" : "Reset your password";
  const label = verification ? "verification" : "password reset";
  const introduction = verification
    ? "Welcome to Sangai. Enter the code below in the app to verify your email address."
    : "Enter the code below in Sangai to choose a new password for your account.";
  const unexpected = verification
    ? "If you did not create a Sangai account or request this code, you can safely ignore this email."
    : "If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.";
  const preheader = `Your Sangai ${label} code is ready. It expires in 15 minutes.`;

  return {
    subject: verification
      ? "Your Sangai verification code"
      : "Your Sangai password reset code",
    text: [
      "SANGAI",
      heading,
      "",
      introduction,
      "",
      `Your Sangai ${label} code is:`,
      "",
      code,
      "",
      "This code expires in 15 minutes and can be used once.",
      "For your security, never share this code with anyone.",
      "",
      unexpected,
      "",
      "Sangai Beta | Account security",
      "This is an automated account security email.",
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${heading} | Sangai</title>
  <style>
    @media only screen and (max-width: 480px) {
      .outer-padding { padding: 24px 12px !important; }
      .card-padding { padding: 32px 24px !important; }
      .otp-code { font-size: 32px !important; letter-spacing: 6px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#faf7f6;color:#302a2d;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;color:#faf7f6;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#faf7f6;">
    <tr>
      <td align="center" class="outer-padding" style="padding:48px 20px;">
        <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 0 24px 4px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:bold;letter-spacing:-1px;color:#8f3655;">Sangai<span style="color:#cba1ad;">.</span></span>
              <span style="display:block;margin-top:6px;font-size:10px;font-weight:bold;letter-spacing:2px;color:#756a70;">ACCOUNT SECURITY</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border:1px solid #eadfe3;border-top:4px solid #a74b69;border-radius:12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="card-padding" style="padding:40px;">
                    <h1 style="margin:0 0 16px;font-size:26px;line-height:34px;font-weight:700;letter-spacing:-0.5px;color:#302a2d;">${heading}</h1>
                    <p style="margin:0 0 28px;font-size:15px;line-height:25px;color:#655b62;">${introduction}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fcf5f7;border:1px solid #f0dfe5;border-radius:8px;">
                      <tr>
                        <td align="center" style="padding:24px 12px;">
                          <p style="margin:0 0 12px;font-size:10px;line-height:16px;font-weight:bold;letter-spacing:1.5px;color:#8f3655;">YOUR ONE-TIME CODE</p>
                          <p class="otp-code" style="margin:0;font-family:'Courier New',Courier,monospace;font-size:38px;line-height:48px;font-weight:bold;letter-spacing:8px;color:#702b43;">${code}</p>
                          <p style="margin:12px 0 0;font-size:12px;line-height:18px;color:#75636d;">Expires in 15 minutes &middot; Use once</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:24px 0 0;font-size:13px;line-height:21px;color:#655b62;"><strong style="color:#302a2d;">Keep this code private.</strong><br>For your security, never share it with anyone.</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                      <tr><td style="border-top:1px solid #eee6e9;padding-top:20px;"><p style="margin:0;font-size:12px;line-height:20px;color:#81747c;">${unexpected}</p></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 16px 0;">
              <p style="margin:0;font-size:11px;line-height:18px;color:#8b7e85;">Sangai Beta &middot; Account security</p>
              <p style="margin:4px 0 0;font-size:11px;line-height:18px;color:#8b7e85;">This is an automated account security email.</p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}
