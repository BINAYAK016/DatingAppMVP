import React, { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { C, IconButton, PrivateImage } from "./ui";
export function PhotoCarousel({
  items,
  onOpen,
}: {
  items: { id: string }[];
  onOpen: (id: string) => void;
}) {
  const [width, setWidth] = useState(340),
    [index, setIndex] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const move = (next: number) => {
    setIndex(next);
    scroll.current?.scrollTo({ x: next * width, animated: true });
  };
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.frame}
    >
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setIndex(
            Math.max(
              0,
              Math.min(
                items.length - 1,
                Math.round(event.nativeEvent.contentOffset.x / width),
              ),
            ),
          )
        }
      >
        {items.map((item, i) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`View full photo${items.length > 1 ? ` ${i + 1}` : ""}`}
            onPress={() => onOpen(item.id)}
            style={{
              width,
              height: Math.min(420, width * 1.18),
              flexShrink: 0,
            }}
          >
            {Math.abs(i - index) <= 1 ? (
              <PrivateImage
                id={item.id}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: C.blush }} />
            )}
          </Pressable>
        ))}
      </ScrollView>
      {items.length > 1 && (
        <>
          <Text style={styles.count}>
            {index + 1} / {items.length}
          </Text>
          <View style={styles.navigation}>
            <IconButton
              name="chevron-back"
              label="Previous photo"
              variant="soft"
              disabled={index === 0}
              onPress={() => move(index - 1)}
            />
            <View style={styles.dots}>
              {items.map((item, i) => (
                <View
                  key={item.id}
                  style={[
                    styles.dot,
                    { backgroundColor: i === index ? C.primary : C.line },
                  ]}
                />
              ))}
            </View>
            <IconButton
              name="chevron-forward"
              label="Next photo"
              variant="soft"
              disabled={index === items.length - 1}
              onPress={() => move(index + 1)}
            />
          </View>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { borderRadius: 18, overflow: "hidden", backgroundColor: C.blush },
  count: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#2C2529BF",
    color: C.white,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 15,
    fontSize: 12,
  },
  navigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.bg,
    paddingVertical: 2,
  },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
