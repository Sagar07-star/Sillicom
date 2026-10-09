import { FlatList } from 'react-native';
import { usePreferences } from '../store/preferences';
import { ItemCard } from '../components/ItemCard';
import { EmptyState } from '../components/UI';
export default function Saved() {
  const items = usePreferences((s) => s.saved);
  return <FlatList data={items} keyExtractor={(i) => String(i.id)} contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 12 }} renderItem={({ item }) => <ItemCard item={item} remove />} ListEmptyComponent={<EmptyState title="A home for good finds" detail="Swipe right on news, or tap Save on any item." />} />;
}
