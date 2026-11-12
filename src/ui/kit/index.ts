// The game's own UI library. Every panel, menu, sign and label is built from
// these parts, so a control looks, sounds and behaves the same everywhere
// (docs/controls-and-ui.md "UI library"). Import from here, not from the
// part's own file. Sizes are cm in the rigs, layout pixels on canvases.
//
//   Controls:  PokeButton (`locked`: it only buzzes), Slider (also upright: `vertical`), Switch (on and off:
//              knob side, color and the word), StandButton, ScrollList (swipe to scroll, tap to select,
//              or tap only and scrolled by a slider), FightButton (rectangular, like the Tabs),
//              Tabs (floating over a panel's top border), TextField (the system keyboard; isTyping),
//              NumberStepper, ChoicePicker, SeedControl, RangeSlider (two handles), SettingRow (name,
//              control, value from a spec), ScrollArea (a column of items and the scrollbar: every
//              page that scrolls; Slider `scrollbar` is its pill-handle look), armControls, changeTouch
//   Labels:    CanvasLabel (a small canvas on a panel, redrawn only when asked)
//   Panels:    Panel (a parchment board with a canvas), LazyFollow (menus that follow the head), centerAbove,
//              GlassSign (the see-through hint sign that follows the look, with an optional live bar),
//              uiCenterY (every menu panel's height: in front of the eyes, inside UI_ZONE)
//   Layout:    rowX, bottomRowY, panelMap, stepValue, clamp01, angleTo (no Three.js); the room around
//              everything in a panel is UI_SPACING (config): edge, top and label gaps
//   Drawing:   drawTitleBanner, drawLine, drawOutlined, UI_COLORS, and the Kenney UI images
//              (drawBanner, drawIcon, drawNineSlice, fitFont, wrapText, arrowCanvas, buttonIconCanvas), and the
//              menu icons drawn in code (drawStar, drawSkull, drawMenuIcon)
//   Rendering: canvasTexture, canvasPlane, drawOnTop (order of every layer: RENDER_ORDER in src/config/game.ts)
export { Panel, PANEL_INK, centerAbove, type PanelOptions } from '../panel.js';
export { PokeButton, type ButtonOptions } from '../pokeButton.js';
export { drawMenuIcon, drawSkull, drawStar, type MenuIcon } from './menuIcons.js';
export { ScrollList, type ScrollListOptions } from './scrollList.js';
export { FightButton } from './fightButton.js';
export { Tabs } from './tabs.js';
export { TextField, isTyping, useKeyboardSession, type TextFieldOptions } from './textField.js';
export { ChoicePicker, NumberStepper, SeedControl } from './pickers.js';
export { RangeSlider } from './rangeSlider.js';
export { FieldRow, SettingRow, type RowSpec, type RowValue } from './settingRow.js';
export { ActionButton } from './actionButton.js';
export { PanelHeader } from './panelHeader.js';
export { ScrollArea, type ScrollItem, type ScrollAreaOptions } from './scrollArea.js';
export { CanvasLabel } from './label.js';
export { type ActionIcon } from './actionIcons.js';
export { Slider, type SliderOptions } from '../slider.js';
export { Switch, type SwitchOptions } from '../switch.js';
export { StandButton, type StandOptions } from './standButton.js';
export { LazyFollow, type FollowOptions } from './lazyFollow.js';
export { GlassSign, type GlassBar } from './glassSign.js';
export { armControls, changeTouch, type Control } from './controls.js';
export { angleTo, bottomRowY, clamp01, panelMap, rowPanelWidth, rowX, stepValue, type PanelMap } from './layout.js';
export { drawLine, drawOutlined, drawTitleBanner, truncate, UI_COLORS } from './text.js';
export { canvasPlane, canvasTexture } from './canvas.js';
export { drawOnTop, layerPage } from './onTop.js';
// Where panels sit up and down: right in front of the eyes, inside UI_ZONE (config).
export { fitsUiZone, menuCenterY, uiCenterY } from '../../rules/reach.js';
export {
  arrowCanvas,
  buttonIconCanvas,
  drawBanner,
  drawIcon,
  drawNineSlice,
  fitFont,
  loadUiImages,
  wrapText,
  type ButtonIcon,
  type UiImageName,
} from '../uiImages.js';
