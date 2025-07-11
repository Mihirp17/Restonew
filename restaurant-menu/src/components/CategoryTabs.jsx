export default function CategoryTabs({ categories, selected, onSelect }) {
  return (
    <div className="flex gap-2 mt-2 overflow-x-auto px-2 pb-2">
      {categories.map((cat) => (
        <button
          key={cat}
          className={`px-4 py-2 rounded-full text-sm font-semibold border ${cat === selected ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200'} transition`}
          onClick={() => onSelect(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}