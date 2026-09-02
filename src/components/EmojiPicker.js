import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Searchbar, Text } from 'react-native-paper';

const EMOJI_CATEGORIES = {
  'Smileys': ['😀','😂','🥹','😍','🥳','😎','🤩','😢','😤','🤔','🫡','💀','👻','🤡','👽','🤖','😊','🙌','😏','🫠','🥲','😭','😡','🤯','😳','🤗','😴','🤑','🤠','😈','🎅','🥶'],
  'Gestures': ['👍','👎','👏','🙌','🤝','💪','🫶','👋','✌️','🤙','🫰','👆','👇','👈','👉','❤️','🫂','🙏','✊','🤞','🫵','👐','🤟','🤘','👌','🫳','🫷','🫸','🖖','✋','🤚','🖐️'],
  'Objects': ['🔥','✨','💯','🎉','🎊','💎','🏆','🎵','🎶','💡','📸','🔗','⏰','💬','💭','🫧','📱','💻','🎮','🎧','🔑','📌','💎','🧲','🎁','🎪','🎨','🎬','📡','🔮','⚡','🧸'],
  'Nature': ['🌈','☀️','🌙','⭐','🌊','🌸','🍀','🦊','🐱','🐶','🦋','🐝','🌺','🌴','❄️','🌑','🌍','🌸','🦄','🐸','🐧','🐦','🦈','🐬','🦎','🐙','🦜','🐊','🐺','🦅','🐿️','🦔'],
  'Food': ['🍕','🍔','🍟','🌮','🍣','🍩','🍪','🍫','☕','🧋','🍷','🥂','🍎','🍓','🥑','🌶️','🧀','🥓','🥚','🥞','🧇','🍿','🥤','🫕','🍜','🍝','🥗','🍱','🧁','🍰','🍦','🫖'],
  'Activities': ['⚽','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🥊','🎯','⛳','🎮','🎲','🧩','🎭','🎪','🎤','🎨','🎬','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🎫','🎟️','🎳','🎿','🏂','🏋️'],
  'Travel': ['🚗','✈️','🚀','🛸','🏠','🏖️','🏔️','🌋','🗼','🏰','🌉','🗺️','🧭','🚂','🚁','⛵','🚎','🏍️','🛺','🚲','🛴','🚀','⛵','🚤','🛥️','🛳️','⛴️','🏕️','⛺','🛖','🕌','⛩️'],
};

const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flat();

const createStyles = (c) => StyleSheet.create({
  container: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: c.surfaceVariant,
    paddingTop: 12,
    maxHeight: 320,
  },
  search: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: c.background,
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
    backgroundColor: c.surfaceVariant,
  },
  categoryText: {
    color: c.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  activeCategoryText: {
    color: c.primary,
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

export default function EmojiPicker({ onSelect, colors }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Smileys');
  const styles = useMemo(() => createStyles(colors), [colors]);

  const emojis = search
    ? ALL_EMOJIS.filter((e) => e.includes(search))
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
        keyboardShouldPersistTaps="always"
        renderItem={({ item }) => (
          <Pressable style={styles.emojiBtn} onPress={() => onSelect(item)}>
            <Text style={styles.emoji}>{item}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
