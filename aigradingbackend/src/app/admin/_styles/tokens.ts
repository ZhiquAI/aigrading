export const adminTokens = {
    page: 'max-w-6xl mx-auto',
    headerTitle: 'text-2xl font-bold text-gray-900',
    headerSubtitle: 'text-gray-500 text-sm mt-1',
    card: 'bg-white border border-gray-100 rounded-2xl shadow-sm',
    cardDense: 'bg-white border border-gray-200 rounded-xl shadow-sm',
    filterBar: 'flex flex-wrap gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm',
};

export const adminCx = (...classes: Array<string | undefined | null | false>) =>
    classes.filter(Boolean).join(' ');
