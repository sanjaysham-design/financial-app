// Removed: this endpoint used to return the app's API keys to any visitor.
// Keys are now read server-side by each API route. Safe to delete this file.
export default function handler(req, res) {
  res.status(410).json({ error: 'Gone' });
}
