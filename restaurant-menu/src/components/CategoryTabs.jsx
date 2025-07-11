export default function CategoryTabs({ categories, selected, onSelect }) {
  return (
    <div className="flex gap-2 mt-2 overflow-x-auto px-2 pb-2">
      {categories.map((cat) => (
        <button
          key={cat}
          className={`px-4 py-2 rounded-full text-sm font-semibold border transition whitespace-nowrap ${cat === selected ? 'bg-orange-500 text-white border-orange-500 shadow' : 'bg-white text-orange-500 border-orange-200'}`}
          onClick={() => onSelect(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}