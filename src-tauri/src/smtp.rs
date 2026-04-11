use lettre::message::header::ContentType;
use lettre::message::{Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParametersBuilder};
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub security: String, // "ssl" | "starttls" | "none"
}

#[derive(Debug, Deserialize)]
pub struct EmailRecipient {
    pub address: String,
    pub name: Option<String>,
}

fn parse_mailbox(recipient: &EmailRecipient) -> Result<Mailbox, String> {
    let email = recipient
        .address
        .parse()
        .map_err(|e| format!("Invalid email address '{}': {}", recipient.address, e))?;
    Ok(match &recipient.name {
        Some(name) => Mailbox::new(Some(name.clone()), email),
        None => Mailbox::new(None, email),
    })
}

fn build_transport(config: &SmtpConfig) -> Result<AsyncSmtpTransport<Tokio1Executor>, String> {
    let creds = Credentials::new(config.username.clone(), config.password.clone());

    let builder = match config.security.as_str() {
        "ssl" => {
            let tls_params = TlsParametersBuilder::new(config.host.clone())
                .build_native()
                .map_err(|e| format!("TLS parameter error: {}", e))?;
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host)
                .port(config.port)
                .tls(Tls::Wrapper(tls_params))
                .credentials(creds)
        }
        "starttls" => {
            let tls_params = TlsParametersBuilder::new(config.host.clone())
                .build_native()
                .map_err(|e| format!("TLS parameter error: {}", e))?;
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host)
                .port(config.port)
                .tls(Tls::Required(tls_params))
                .credentials(creds)
        }
        "none" => AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host)
            .port(config.port)
            .tls(Tls::None)
            .credentials(creds),
        other => return Err(format!("Unknown security type: {}", other)),
    };

    Ok(builder.build())
}

#[tauri::command]
pub async fn smtp_test_connection(
    host: String,
    port: u16,
    username: String,
    password: String,
    security: String,
) -> Result<bool, String> {
    let config = SmtpConfig {
        host,
        port,
        username,
        password,
        security,
    };

    let transport = build_transport(&config)?;
    transport
        .test_connection()
        .await
        .map_err(|e| format!("SMTP connection test failed: {}", e))
}

#[tauri::command]
pub async fn smtp_send_email(
    host: String,
    port: u16,
    username: String,
    password: String,
    security: String,
    from: EmailRecipient,
    to: Vec<EmailRecipient>,
    cc: Vec<EmailRecipient>,
    bcc: Vec<EmailRecipient>,
    subject: String,
    body_text: Option<String>,
    body_html: Option<String>,
    in_reply_to: Option<String>,
    references: Option<String>,
) -> Result<String, String> {
    let config = SmtpConfig {
        host,
        port,
        username,
        password,
        security,
    };

    let from_mailbox = parse_mailbox(&from)?;

    let mut builder = Message::builder().from(from_mailbox).subject(&subject);

    for recipient in &to {
        builder = builder.to(parse_mailbox(recipient)?);
    }
    for recipient in &cc {
        builder = builder.cc(parse_mailbox(recipient)?);
    }
    for recipient in &bcc {
        builder = builder.bcc(parse_mailbox(recipient)?);
    }

    if let Some(ref reply_to) = in_reply_to {
        builder = builder.in_reply_to(reply_to.clone());
    }
    if let Some(ref refs) = references {
        builder = builder.references(refs.clone());
    }

    let email = match (&body_text, &body_html) {
        (Some(text), Some(html)) => builder
            .multipart(
                MultiPart::alternative()
                    .singlepart(
                        SinglePart::builder()
                            .content_type(ContentType::TEXT_PLAIN)
                            .body(text.clone()),
                    )
                    .singlepart(
                        SinglePart::builder()
                            .content_type(ContentType::TEXT_HTML)
                            .body(html.clone()),
                    ),
            )
            .map_err(|e| format!("Failed to build email: {}", e))?,
        (None, Some(html)) => builder
            .header(ContentType::TEXT_HTML)
            .body(html.clone())
            .map_err(|e| format!("Failed to build email: {}", e))?,
        (Some(text), None) => builder
            .header(ContentType::TEXT_PLAIN)
            .body(text.clone())
            .map_err(|e| format!("Failed to build email: {}", e))?,
        (None, None) => builder
            .header(ContentType::TEXT_PLAIN)
            .body(String::new())
            .map_err(|e| format!("Failed to build email: {}", e))?,
    };

    let transport = build_transport(&config)?;
    let response = transport
        .send(email)
        .await
        .map_err(|e| format!("Failed to send email: {}", e))?;

    Ok(format!("{}", response.code()))
}
