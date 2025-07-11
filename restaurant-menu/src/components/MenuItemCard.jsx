export default function MenuItemCard({ item, onAdd }) {
  const price = typeof item.price === "number" ? item.price : parseFloat(item.price);
  return (
    <div className="bg-white rounded-2xl shadow-md p-4 flex items-center gap-4 hover:shadow-lg transition-all">
      <img src={item.img || item.image || 'https://placehold.co/80x80'} alt={item.name} className="w-20 h-20 object-cover rounded-xl border border-gray-100" />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-lg text-gray-900 truncate">{item.name}</div>
        <div className="text-gray-500 text-xs mb-1 truncate">{item.desc || item.description}</div>
        <div className="font-semibold text-orange-500 text-base mt-1">${price.toFixed(2)}</div>
      </div>
      <button
        className="bg-orange-500 text-white rounded-full px-4 py-2 font-bold text-lg hover:bg-orange-600 transition shadow"
        onClick={() => onAdd(item)}
      >
        +
      </button>
    </div>
  );
}