document.addEventListener('DOMContentLoaded', () => {
  const pollData = document.getElementById('poll-data');
  if (!pollData) return;

  const batchId = pollData.getAttribute('data-batch-id');
  const initialHolderId = pollData.getAttribute('data-holder-id');
  const initialTimestamp = pollData.getAttribute('data-timestamp');

  setInterval(async () => {
    // Skip if page is not visible
    if (document.visibilityState === 'hidden') return;

    try {
      const response = await fetch(`/api/potato/${batchId}`);
      if (!response.ok) return;

      const data = await response.json();
      if (!data) return;

      const currentHolderId = data.holderId || '';
      const currentTimestamp = data.timestamp ? new Date(data.timestamp).getTime().toString() : '';

      if (currentHolderId !== initialHolderId || currentTimestamp !== initialTimestamp) {
        // State has changed, reload page to get fresh data
        window.location.reload();
      }
    } catch (err) {
      console.error('Error polling potato state:', err);
    }
  }, 8000); // 8 seconds
});
