import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Searchbar, Text } from 'react-native-paper';
import { colors } from '../theme/theme';

const EMOJI_CATEGORIES = {
  'Smileys': ['😀','😂','🥹','😍','🥳','😎','🤩','😢','😤','🤔','🫡','💀','👻','🤡','👽','🤖'],
  'Gestures': ['👍','👎','👏','🙌','🤝','💪','🫶','👋','✌️','🤙','🫰','👆','👇','👈','👉','❤️'],
  'Objects': ['🔥','✨','💯','🎉','🎊','💎','🏆','🎵','🎶','💡','📸','🔗','⏰','💬','💭','🫧'],
  'Nature': ['🌈','☀️','🌙','⭐','🌊','🌸','🍀','🦊','🐱','🐶','🦋','🐝','🌺','🌴','🔥','❄️'],
  'Food': ['🍕','🍔','🍟','🌮','🍣','🍩','🍪','🍫','☕','🧋','🍷','🥂','🍎','🍓','🥑','🌶️'],
};

const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flat();

export default function EmojiPicker({ onSelect }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Smileys');

  const emojis = search
    ? ALL_EMOJIS.filter(() => true)
    : EMOJI_CATEGORIES[activeCategory] || ALL_EMOJIS;

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search emoji..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
        placeholderTextColor={colors.muted}
        iconColor={colors.muted}
        textColor={colors.onSurface}
      />
      <View style={styles.categories}>
        {Object.keys(EMOJI_CATEGORIES).map((cat) => (
          <Pressable
            key={cat}
            onPress={() => { setActiveCategory(cat); setSearch(''); }}
            style={[styles.categoryTab, activeCategory === cat && !search && styles.activeTab]}
          >
            <Text style={[styles.categoryText, activeCategory === cat && !search && styles.activeCategoryText]}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={emojis}
        keyExtractor={(item, i) => `${item}-${i}`}
        numColumns={8}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <Pressable style={styles.emojiBtn} onPress={() => onSelect(item)}>
            <Text style={styles.emoji}>{item}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    maxHeight: 320,
  },
  search: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: colors.background,
    height: 40,
  },
  categories: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  categoryTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: colors.surfaceVariant,
  },
  categoryText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  activeCategoryText: {
    color: colors.primary,
  },
  grid: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  emojiBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    maxWidth: '12.5%',
  },
  emoji: {
    fontSize: 24,
  },
});
