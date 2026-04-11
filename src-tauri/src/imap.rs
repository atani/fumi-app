use async_imap::Client as ImapClient;
use async_native_tls::TlsConnector;
use async_std::net::TcpStream;
use futures::StreamExt;
use mail_parser::MessageParser;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ImapConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub security: String, // "ssl" | "starttls" | "none"
}

#[derive(Debug, Serialize, Clone)]
pub struct ImapFolder {
    pub name: String,
    pub delimiter: String,
    pub flags: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ImapMessage {
    pub uid: u32,
    pub subject: Option<String>,
    pub from_address: Option<String>,
    pub from_name: Option<String>,
    pub to_addresses: Option<String>,
    pub cc_addresses: Option<String>,
    pub date: Option<String>,
    pub is_read: bool,
    pub has_attachments: bool,
    pub snippet: Option<String>,
    pub message_id: Option<String>,
    pub references: Option<String>,
    pub in_reply_to: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ImapMessageBody {
    pub uid: u32,
    pub body_html: Option<String>,
    pub body_text: Option<String>,
    pub subject: Option<String>,
    pub from_address: Option<String>,
    pub from_name: Option<String>,
    pub to_addresses: Option<String>,
    pub cc_addresses: Option<String>,
    pub date: Option<String>,
    pub message_id: Option<String>,
    pub references: Option<String>,
    pub in_reply_to: Option<String>,
}

type TlsSession = async_imap::Session<async_native_tls::TlsStream<TcpStream>>;
type PlainSession = async_imap::Session<TcpStream>;

fn extract_snippet(text: &str, max_len: usize) -> String {
    let cleaned: String = text
        .chars()
        .map(|c| if c.is_whitespace() { ' ' } else { c })
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.len() <= max_len {
        trimmed.to_string()
    } else {
        format!("{}...", &trimmed[..max_len])
    }
}

fn extract_from(msg: &mail_parser::Message<'_>) -> (Option<String>, Option<String>) {
    if let Some(from) = msg.from() {
        let addrs = from.clone().into_list();
        if let Some(addr) = addrs.first() {
            return (
                addr.name().map(|n| n.to_string()),
                addr.address().map(|a| a.to_string()),
            );
        }
    }
    (None, None)
}

fn extract_addresses(addr: Option<&mail_parser::Address<'_>>) -> Option<String> {
    addr.map(|a| {
        a.clone()
            .into_list()
            .iter()
            .filter_map(|item| item.address().map(|s| s.to_string()))
            .collect::<Vec<_>>()
            .join(", ")
    })
}

fn extract_header_text_list(header: &mail_parser::HeaderValue<'_>) -> Option<String> {
    header.as_text_list().map(|list| {
        list.iter()
            .map(|id| id.to_string())
            .collect::<Vec<_>>()
            .join(" ")
    })
}

fn parse_envelope(raw: &[u8]) -> ImapMessage {
    let parser = MessageParser::default();
    match parser.parse(raw) {
        Some(msg) => {
            let (from_name, from_address) = extract_from(&msg);
            let to_addresses = extract_addresses(msg.to());
            let cc_addresses = extract_addresses(msg.cc());
            let has_attachments = msg.attachment_count() > 0;
            let snippet = msg
                .body_text(0)
                .map(|t| extract_snippet(&t, 200))
                .or_else(|| msg.body_html(0).map(|h| extract_snippet(&h, 200)));
            let date = msg.date().map(|d| d.to_rfc3339());
            let message_id = msg.message_id().map(|s| s.to_string());
            let references = extract_header_text_list(msg.references());
            let in_reply_to = extract_header_text_list(msg.in_reply_to());

            ImapMessage {
                uid: 0,
                subject: msg.subject().map(|s| s.to_string()),
                from_address,
                from_name,
                to_addresses,
                cc_addresses,
                date,
                is_read: false,
                has_attachments,
                snippet,
                message_id,
                references,
                in_reply_to,
            }
        }
        None => ImapMessage {
            uid: 0,
            subject: None,
            from_address: None,
            from_name: None,
            to_addresses: None,
            cc_addresses: None,
            date: None,
            is_read: false,
            has_attachments: false,
            snippet: None,
            message_id: None,
            references: None,
            in_reply_to: None,
        },
    }
}

fn parse_full_body(raw: &[u8]) -> ImapMessageBody {
    let parser = MessageParser::default();
    match parser.parse(raw) {
        Some(msg) => {
            let (from_name, from_address) = extract_from(&msg);
            let to_addresses = extract_addresses(msg.to());
            let cc_addresses = extract_addresses(msg.cc());
            let body_html = msg.body_html(0).map(|s| s.to_string());
            let body_text = msg.body_text(0).map(|s| s.to_string());
            let date = msg.date().map(|d| d.to_rfc3339());
            let message_id = msg.message_id().map(|s| s.to_string());
            let references = extract_header_text_list(msg.references());
            let in_reply_to = extract_header_text_list(msg.in_reply_to());

            ImapMessageBody {
                uid: 0,
                body_html,
                body_text,
                subject: msg.subject().map(|s| s.to_string()),
                from_address,
                from_name,
                to_addresses,
                cc_addresses,
                date,
                message_id,
                references,
                in_reply_to,
            }
        }
        None => ImapMessageBody {
            uid: 0,
            body_html: None,
            body_text: None,
            subject: None,
            from_address: None,
            from_name: None,
            to_addresses: None,
            cc_addresses: None,
            date: None,
            message_id: None,
            references: None,
            in_reply_to: None,
        },
    }
}

fn process_fetch_to_messages(fetches: &[async_imap::types::Fetch]) -> Vec<ImapMessage> {
    let mut messages: Vec<ImapMessage> = Vec::new();
    for fetch in fetches {
        let uid = match fetch.uid {
            Some(uid) => uid,
            None => continue,
        };

        let header = fetch.header().unwrap_or(&[]);
        let text = fetch.text().unwrap_or(&[]);
        let mut raw = Vec::with_capacity(header.len() + text.len());
        raw.extend_from_slice(header);
        raw.extend_from_slice(text);

        let mut msg = parse_envelope(&raw);
        msg.uid = uid;
        msg.is_read = fetch
            .flags()
            .any(|f| matches!(f, async_imap::types::Flag::Seen));

        messages.push(msg);
    }
    messages.sort_by(|a, b| b.uid.cmp(&a.uid));
    messages
}

async fn connect_tls(config: &ImapConfig) -> Result<TlsSession, String> {
    let tls = TlsConnector::new()
        .danger_accept_invalid_certs(false)
        .danger_accept_invalid_hostnames(false);

    let stream = TcpStream::connect((config.host.as_str(), config.port))
        .await
        .map_err(|e| format!("TCP connection failed: {}", e))?;
    let tls_stream = tls
        .connect(&config.host, stream)
        .await
        .map_err(|e| format!("TLS handshake failed: {}", e))?;
    let client = ImapClient::new(tls_stream);
    client
        .login(&config.username, &config.password)
        .await
        .map_err(|e| format!("IMAP login failed: {}", e.0))
}

async fn connect_plain(config: &ImapConfig) -> Result<PlainSession, String> {
    let stream = TcpStream::connect((config.host.as_str(), config.port))
        .await
        .map_err(|e| format!("TCP connection failed: {}", e))?;
    let client = ImapClient::new(stream);
    client
        .login(&config.username, &config.password)
        .await
        .map_err(|e| format!("IMAP login failed: {}", e.0))
}

// Macro to avoid duplicating logic for TLS vs plain sessions.
// async-imap returns different opaque types per generic parameter,
// so we cannot use a trait object or enum without boxing streams.
macro_rules! with_session {
    ($config:expr, $session:ident, $body:block) => {
        match $config.security.as_str() {
            "ssl" | "starttls" => {
                let mut $session = connect_tls($config).await?;
                let result = $body;
                let _ = $session.logout().await;
                result
            }
            "none" => {
                let mut $session = connect_plain($config).await?;
                let result = $body;
                let _ = $session.logout().await;
                result
            }
            other => Err(format!("Unknown security type: {}", other)),
        }
    };
}

#[tauri::command]
pub async fn imap_test_connection(
    host: String,
    port: u16,
    username: String,
    password: String,
    security: String,
) -> Result<bool, String> {
    let config = ImapConfig {
        host,
        port,
        username,
        password,
        security,
    };

    with_session!(&config, session, { Ok(true) })
}

#[tauri::command]
pub async fn imap_list_folders(
    host: String,
    port: u16,
    username: String,
    password: String,
    security: String,
) -> Result<Vec<ImapFolder>, String> {
    let config = ImapConfig {
        host,
        port,
        username,
        password,
        security,
    };

    with_session!(&config, session, {
        let names: Vec<_> = session
            .list(Some(""), Some("*"))
            .await
            .map_err(|e| format!("Failed to list folders: {}", e))?
            .collect::<Vec<_>>()
            .await;

        let folders = names
            .into_iter()
            .filter_map(|r| r.ok())
            .map(|name| {
                let flags: Vec<String> = name
                    .attributes()
                    .iter()
                    .map(|attr| format!("{:?}", attr))
                    .collect();
                ImapFolder {
                    name: name.name().to_string(),
                    delimiter: name
                        .delimiter()
                        .map(|d| d.to_string())
                        .unwrap_or_default(),
                    flags,
                }
            })
            .collect();

        Ok(folders)
    })
}

#[tauri::command]
pub async fn imap_fetch_messages(
    host: String,
    port: u16,
    username: String,
    password: String,
    security: String,
    folder: String,
    count: u32,
) -> Result<Vec<ImapMessage>, String> {
    let config = ImapConfig {
        host,
        port,
        username,
        password,
        security,
    };

    with_session!(&config, session, {
        let mailbox = session
            .select(&folder)
            .await
            .map_err(|e| format!("Failed to select folder '{}': {}", folder, e))?;

        let total = mailbox.exists;
        if total == 0 {
            return Ok(Vec::new());
        }

        let start = if total > count {
            total - count + 1
        } else {
            1
        };
        let range = format!("{}:*", start);

        let fetches: Vec<_> = session
            .uid_fetch(&range, "(UID FLAGS BODY.PEEK[HEADER] BODY.PEEK[TEXT])")
            .await
            .map_err(|e| format!("Failed to fetch messages: {}", e))?
            .collect::<Vec<_>>()
            .await;

        let fetches: Vec<_> = fetches.into_iter().filter_map(|r| r.ok()).collect();
        Ok(process_fetch_to_messages(&fetches))
    })
}

#[tauri::command]
pub async fn imap_fetch_message_body(
    host: String,
    port: u16,
    username: String,
    password: String,
    security: String,
    folder: String,
    uid: u32,
) -> Result<ImapMessageBody, String> {
    let config = ImapConfig {
        host,
        port,
        username,
        password,
        security,
    };

    let uid_str = uid.to_string();

    with_session!(&config, session, {
        session
            .select(&folder)
            .await
            .map_err(|e| format!("Failed to select folder '{}': {}", folder, e))?;

        let fetches: Vec<_> = session
            .uid_fetch(&uid_str, "(UID BODY[])")
            .await
            .map_err(|e| format!("Failed to fetch message body: {}", e))?
            .collect::<Vec<_>>()
            .await;

        let fetches: Vec<_> = fetches.into_iter().filter_map(|r| r.ok()).collect();
        let fetch = fetches
            .first()
            .ok_or_else(|| format!("Message with UID {} not found", uid))?;

        let body = fetch.body().unwrap_or(&[]);
        let mut result = parse_full_body(body);
        result.uid = uid;

        Ok(result)
    })
}
