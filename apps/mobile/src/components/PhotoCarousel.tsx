import React, { useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { C, IconButton, PrivateImage } from "./ui";
type Props = {
  items: { id: string }[];
  onOpen: (id: string) => void;
};
export function PhotoCarousel({ items, onOpen }: Props) {
  // A different ordered collection must never retain another photo's selection.
  return items.length ? (
    <CarouselFrames
      key={items.map((item) => item.id).join(":")}
      items={items}
      onOpen={onOpen}
    />
  ) : null;
}
function CarouselFrames({ items, onOpen }: Props) {
  const [width, setWidth] = useState(340),
    [index, setIndex] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const measuredWidth = useRef(340),
    selection = useRef(0),
    target = useRef<number | null>(0);
  const move = (next: number) => {
    const selected = Math.max(0, Math.min(items.length - 1, next));
    selection.current = selected;
    target.current = selected;
    setIndex(selected);
    scroll.current?.scrollTo({ x: selected * width, animated: true });
  };
  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Ignore queued momentum from the ScrollView replaced by a width change.
    if (
      width !== measuredWidth.current ||
      Math.abs(event.nativeEvent.layoutMeasurement.width - width) > 1
    )
      return;
    const offset = event.nativeEvent.contentOffset.x;
    if (target.current !== null) {
      if (Math.abs(offset - target.current * width) > 1) return;
      target.current = null;
    }
    const selected = Math.max(
      0,
      Math.min(items.length - 1, Math.round(offset / width)),
    );
    selection.current = selected;
    setIndex(selected);
  };
  return (
    <View
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next > 0 && next !== measuredWidth.current) {
          measuredWidth.current = next;
          target.current = selection.current;
          setWidth(next);
        }
      }}
      style={styles.frame}
    >
      <ScrollView
        key={width}
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => {
          if (width !== measuredWidth.current) return;
          target.current = selection.current;
          // Resnap after the resized photo frames have actually been laid out.
          scroll.current?.scrollTo({
            x: selection.current * width,
            animated: false,
          });
        }}
        onScrollBeginDrag={() => {
          target.current = null;
        }}
        onTouchStart={() => {
          target.current = null;
        }}
        onMomentumScrollEnd={settle}
        onScroll={Platform.OS === "web" ? settle : undefined}
        scrollEventThrottle={16}
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
