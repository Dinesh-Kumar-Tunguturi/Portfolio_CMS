export default async function handler(req, res) {
  console.log("Vercel Cron triggered to wake up the backend.");

  let backendUrl = process.env.VITE_API_BASE || process.env.BACKEND_URL;

  if (!backendUrl) {
    console.error("Neither VITE_API_BASE nor BACKEND_URL environment variables are defined.");
    return res.status(500).json({
      success: false,
      error: "Backend URL environment variable not configured"
    });
  }

  // Construct target URL for backend health check
  let targetUrl = backendUrl;
  if (targetUrl.endsWith('/api')) {
    targetUrl = targetUrl.substring(0, targetUrl.length - 4) + '/health';
  } else if (!targetUrl.endsWith('/health')) {
    targetUrl = targetUrl.replace(/\/$/, '') + '/health';
  }

  console.log(`Pinging backend at: ${targetUrl}`);

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Vercel-Cron-Wakeup'
      }
    });
    
    clearTimeout(id);
    const text = await response.text();

    console.log(`Backend responded with status ${response.status}: ${text.substring(0, 100)}`);
    return res.status(200).json({
      success: true,
      status: response.status,
      message: `Pinged ${targetUrl} successfully`,
      response: text.substring(0, 100)
    });
  } catch (error) {
    console.error(`Error pinging backend: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
