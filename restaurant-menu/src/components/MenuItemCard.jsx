export default function MenuItemCard({ item, onAdd }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 flex items-center gap-4">
      <img src={item.img} alt={item.name} className="w-20 h-20 object-cover rounded-lg" />
      <div className="flex-1">
        <div className="font-bold text-lg text-gray-900">{item.name}</div>
        <div className="text-gray-500 text-sm mb-1">{item.desc}</div>
        <div className="font-semibold text-red-600">${item.price.toFixed(2)}</div>
      </div>
      <button
        className="bg-red-600 text-white rounded-full px-4 py-2 font-bold text-lg hover:bg-red-700 transition"
        onClick={() => onAdd(item)}
      >
        +
      </button>
    </div>
  );
}