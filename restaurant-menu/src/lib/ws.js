let ws = null;

export function connectWebSocket(restaurantId) {
  if (ws && ws.readyState === 1) return ws;
  ws = new WebSocket(
    `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/restaurant/${restaurantId}`
  );
  return ws;
}

export function sendBillRequest({ restaurantId, tableId, customerName }) {
  if (!ws || ws.readyState !== 1) {
    connectWebSocket(restaurantId);
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'call-waiter',
          payload: {
            restaurantId: parseInt(restaurantId),
            tableId: parseInt(tableId),
            customerName: customerName || 'Guest',
            timestamp: new Date().toISOString(),
          },
        })
      );
    };
  } else {
    ws.send(
      JSON.stringify({
        type: 'call-waiter',
        payload: {
          restaurantId: parseInt(restaurantId),
          tableId: parseInt(tableId),
          customerName: customerName || 'Guest',
          timestamp: new Date().toISOString(),
        },
      })
    );
  }
}