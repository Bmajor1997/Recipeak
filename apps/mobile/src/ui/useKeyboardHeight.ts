// How much of the screen the on-screen keyboard covers right now, 0 while it is closed. KeyboardAvoidingView doesn't
// take effect inside a Modal on Android when the app draws edge to edge, so sheets with a text box move themselves up
// by this much instead.
import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

export function useKeyboardHeight(): number {
  const [height, set_height] = useState(0);
  useEffect(() => {
    // iOS announces the keyboard before it moves, so the sheet moves with it; Android only once it is up.
    const show = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hide = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const shown = Keyboard.addListener(show, (event) => set_height(Math.max(0, event.endCoordinates.height)));
    const hidden = Keyboard.addListener(hide, () => set_height(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return height;
}
