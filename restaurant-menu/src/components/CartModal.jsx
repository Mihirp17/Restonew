export default function CartModal({ cart, onRemove, onClose, onPlaceOrder, cartTotal }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-2xl p-6 shadow-2xl animate-in slide-in-from-bottom">
        <div className="font-bold text-xl mb-4 text-orange-500">Your Cart</div>
        {cart.length === 0 ? (
          <div className="text-gray-500 text-center py-8">Cart is empty</div>
        ) : (
          <div className="space-y-4">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{item.name}</div>
                  <div className="text-gray-500 text-xs">x{item.qty}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-bold text-orange-500">${(typeof item.price === 'number' ? item.price : parseFloat(item.price)) * item.qty}</div>
                  <button className="ml-2 text-gray-400 hover:text-orange-500 text-xl" onClick={() => onRemove(item.id)}>&times;</button>
                </div>
              </div>
            ))}
            <div className="flex justify-between font-bold text-lg pt-4 border-t mt-4">
              <span>Total</span>
              <span className="text-orange-500">${cartTotal.toFixed(2)}</span>
            </div>
            <button
              className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold text-lg hover:bg-orange-600 transition mt-4 shadow"
              onClick={onPlaceOrder}
            >
              Place Order
            </button>
            <button
              className="w-full mt-2 py-2 rounded-lg text-gray-500 hover:bg-gray-100"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}