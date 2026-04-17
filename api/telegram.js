export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return response.status(500).json({ error: "Server configuration error" });
  }

  try {
    const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    const result = await fetch(telegramApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: request.body?.text || "No content provided",
        parse_mode: "HTML",
      }),
    });

    if (result.ok) {
      return response.status(200).json({ success: true });
    } else {
      const errorData = await result.text();
      return response
        .status(500)
        .json({ error: "Failed to dispatch to Telegram" });
    }
  } catch (error) {
    return response.status(500).json({ error: "Internal Server Error" });
  }
}
