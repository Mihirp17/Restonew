export default function OrderPlacedBill({ onRequestBill }) {
  return (
    <div className="fixed bottom-0 left-0 w-full bg-green-50 border-t border-green-200 p-6 flex flex-col items-center z-50 animate-in slide-in-from-bottom">
      <div className="text-green-700 font-bold text-lg mb-2">Order Placed!</div>
      <button
        className="bg-green-600 text-white px-6 py-3 rounded-full font-bold text-lg mt-2 shadow hover:bg-green-700"
        onClick={onRequestBill}
      >
        Request Bill
      </button>
    </div>
  );
}