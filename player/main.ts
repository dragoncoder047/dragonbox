// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { HTML, SVG } from "imperative-html/dist/esm/elements-strict";
import { ColorConfig } from "../editor/ColorConfig";
import { nsLocalStorage_get, nsLocalStorage_save } from "../editor/namespaced_localStorage";
import { oscilloscopeCanvas } from "../global/Oscilloscope";
import { Channel } from "../synth/Channel";
import { Instrument } from "../synth/Instrument";
import { Note, NotePin, Pattern } from "../synth/Pattern";
import { Synth } from "../synth/synth";
import { Chord, Config, Dictionary, DictionaryArray, Envelope, EnvelopeType, InstrumentType, Transition } from "../synth/SynthConfig";

	const {a, button, div, h1, input, canvas} = HTML;
	const {svg, circle, rect, path} = SVG;

	const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|android|ipad|playbook|silk/i.test(navigator.userAgent);

	document.head.appendChild(HTML.style({type: "text/css"}, `
	body {
		color: ${ColorConfig.primaryText};
		background: ${ColorConfig.editorBackground};
	}
	h1 {
		font-weight: bold;
		font-size: 14px;
		line-height: 22px;
		text-align: initial;
		margin: 0;
	}
	a {
		font-weight: bold;
		font-size: 12px;
		line-height: 22px;
		white-space: nowrap;
		color: ${ColorConfig.linkAccent};
	}
	button {
		margin: 0;
		padding: 0;
		position: relative;
		border: none;
		border-radius: 5px;
		background: ${ColorConfig.uiWidgetBackground};
		color: ${ColorConfig.primaryText};
		cursor: pointer;
		font-size: 14px;
		font-family: inherit;
	}
	button:hover, button:focus {
		background: ${ColorConfig.uiWidgetFocus};
	}
	.playButton, .pauseButton {
		padding-left: 24px;
		padding-right: 6px;
	}
	.playButton::before {
		content: "";
		position: absolute;
		left: 6px;
		top: 50%;
		margin-top: -6px;
		width: 12px;
		height: 12px;
		pointer-events: none;
		background: ${ColorConfig.primaryText};
		-webkit-mask-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="-6 -6 12 12"><path d="M 6 0 L -5 6 L -5 -6 z" fill="gray"/></svg>');
		-webkit-mask-repeat: no-repeat;
		-webkit-mask-position: center;
		mask-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="-6 -6 12 12"><path d="M 6 0 L -5 6 L -5 -6 z" fill="gray"/></svg>');
		mask-repeat: no-repeat;
		mask-position: center;
	}
	.pauseButton::before {
		content: "";
		position: absolute;
		left: 6px;
		top: 50%;
		margin-top: -6px;
		width: 12px;
		height: 12px;
		pointer-events: none;
		background: ${ColorConfig.primaryText};
		-webkit-mask-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="-6 -6 12 12"><rect x="-5" y="-6" width="3" height="12" fill="gray"/><rect x="2"  y="-6" width="3" height="12" fill="gray"/></svg>');
		-webkit-mask-repeat: no-repeat;
		-webkit-mask-position: center;
		mask-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="-6 -6 12 12"><rect x="-5" y="-6" width="3" height="12" fill="gray"/><rect x="2"  y="-6" width="3" height="12" fill="gray"/></svg>');
		mask-repeat: no-repeat;
		mask-position: center;
	}
	
	input[type=range] {
		-webkit-appearance: none;
		appearance: none;
		height: 16px;
		margin: 0;
		cursor: pointer;
		background-color: ${ColorConfig.editorBackground};
		touch-action: pan-y;
	}
	input[type=range]:focus {
		outline: none;
	}
	input[type=range]::-webkit-slider-runnable-track {
		width: 100%;
		height: 4px;
		cursor: pointer;
		background: ${ColorConfig.uiWidgetBackground};
	}
	input[type=range]::-webkit-slider-thumb {
		height: 16px;
		width: 4px;
		border-radius: 2px;
		background: ${ColorConfig.primaryText};
		cursor: pointer;
		-webkit-appearance: none;
		margin-top: -6px;
	}
	input[type=range]:focus::-webkit-slider-runnable-track, input[type=range]:hover::-webkit-slider-runnable-track {
		background: ${ColorConfig.uiWidgetFocus};
	}
	input[type=range]::-moz-range-track {
		width: 100%;
		height: 4px;
		cursor: pointer;
		background: ${ColorConfig.uiWidgetBackground};
	}
	input[type=range]:focus::-moz-range-track, input[type=range]:hover::-moz-range-track  {
		background: ${ColorConfig.uiWidgetFocus};
	}
	input[type=range]::-moz-range-thumb {
		height: 16px;
		width: 4px;
		border-radius: 2px;
		border: none;
		background: ${ColorConfig.primaryText};
		cursor: pointer;
	}
	input[type=range]::-ms-track {
		width: 100%;
		height: 4px;
		cursor: pointer;
		background: ${ColorConfig.uiWidgetBackground};
		border-color: transparent;
	}
	input[type=range]:focus::-ms-track, input[type=range]:hover::-ms-track {
		background: ${ColorConfig.uiWidgetFocus};
	}
	input[type=range]::-ms-thumb {
		height: 16px;
		width: 4px;
		border-radius: 2px;
		background: ${ColorConfig.primaryText};
		cursor: pointer;
	}
`));
const colorTheme: string | null = getLocalStorage("colorTheme");
ColorConfig.setTheme(colorTheme === null ? ColorConfig.defaultTheme : colorTheme);

let prevHash: string | null = null;
let id = ((Math.random() * 0xffffffff) >>> 0).toString(16);
let pauseButtonDisplayed = false;
let animationRequest: number | null;
let zoomEnabled = false;
let timelineWidth = 1;
let outVolumeHistoricTimer = 0;
let outVolumeHistoricCap = 0;

const synth = new Synth();
const oscilloscope = new oscilloscopeCanvas(canvas({ width: isMobile? 144:288, height: isMobile?32:64, style: `border:2px solid ${ColorConfig.uiWidgetBackground}; overflow: hidden;` , id: "oscilloscopeAll" }), isMobile?1:2);
const showOscilloscope = getLocalStorage("showOscilloscope") != "false";
if (!showOscilloscope) {
	oscilloscope.canvas.style.display = "none";
	synth.oscEnabled = false;
}
let titleText = h1({ style: "flex-grow: 1; margin: 0 1px; margin-left: 10px; overflow: hidden;" }, "");
	let editLink = a({target: "_top", style: "margin: 0 4px;"}, "✎ Edit");
	let copyLink = a({href: "javascript:void(0)", style: "margin: 0 4px;"}, "⎘ Copy URL");
	let shareLink = a({href: "javascript:void(0)", style: "margin: 0 4px;"}, "⤳ Share");
	let fullscreenLink = a({target: "_top", style: "margin: 0 4px;"}, "⇱ Fullscreen");

let draggingPlayhead = false;
	const playButton = button({style: "width: 100%; height: 100%; max-height: 50px;"});
	const playButtonContainer = div({style: "flex-shrink: 0; display: flex; padding: 2px; width: 80px; height: 100%; box-sizing: border-box; align-items: center;"},
	playButton,
);
	const loopIcon = path({d: "M 4 2 L 4 0 L 7 3 L 4 6 L 4 4 Q 2 4 2 6 Q 2 8 4 8 L 4 10 Q 0 10 0 6 Q 0 2 4 2 M 8 10 L 8 12 L 5 9 L 8 6 L 8 8 Q 10 8 10 6 Q 10 4 8 4 L 8 2 Q 12 2 12 6 Q 12 10 8 10 z"});
	const loopButton = button({title: "loop", style: "background: none; flex: 0 0 12px; margin: 0 3px; width: 12px; height: 12px; display: flex;"}, svg({width: 12, height: 12, viewBox: "0 0 12 12"},
	loopIcon,
));

	const volumeIcon = svg({style: "flex: 0 0 12px; margin: 0 1px; width: 12px; height: 12px;", viewBox: "0 0 12 12"},
		path({fill: ColorConfig.uiWidgetBackground, d: "M 1 9 L 1 3 L 4 3 L 7 0 L 7 12 L 4 9 L 1 9 M 9 3 Q 12 6 9 9 L 8 8 Q 10.5 6 8 4 L 9 3 z"}),
);
const volumeSlider = input({ title: "volume", type: "range", value: 75, min: 0, max: 75, step: 1, style: "width: 12vw; max-width: 100px; margin: 0 1px;" });

	const zoomIcon = svg({width: 12, height: 12, viewBox: "0 0 12 12"},
		circle({cx: "5", cy: "5", r: "4.5", "stroke-width": "1", stroke: "currentColor", fill: "none"}),
		path({stroke: "currentColor", "stroke-width": "2", d: "M 8 8 L 11 11 M 5 2 L 5 8 M 2 5 L 8 5", fill: "none"}),
);
	const zoomButton = button({title: "zoom", style: "background: none; flex: 0 0 12px; margin: 0 3px; width: 12px; height: 12px; display: flex;"},
	zoomIcon,
);

	const timeline = svg({style: "min-width: 0; min-height: 0; touch-action: pan-y pinch-zoom;"});
	const playhead = div({style: `position: absolute; left: 0; top: 0; width: 2px; height: 100%; background: ${ColorConfig.playhead}; pointer-events: none;`});
	const timelineContainer = div({style: "display: flex; flex-grow: 1; flex-shrink: 1; position: relative;"}, timeline, playhead);
	const visualizationContainer = div({style: "display: flex; flex-grow: 1; flex-shrink: 1; height: 0; position: relative; align-items: center; overflow: hidden;"}, timelineContainer);
	let noteFlashElementsPerBar: (SVGPathElement[])[];
	let currentNoteFlashElements: SVGPathElement[] = [];
	let currentNoteFlashBar = -1;
	const notesFlashWhenPlayed = getLocalStorage("notesFlashWhenPlayed") == "true";
	const fixChannelColorOrder = getLocalStorage("fixChannelColorOrder") != "false";

const outVolumeBarBg = SVG.rect({ "pointer-events": "none", width: "90%", height: "50%", x: "5%", y: "25%", fill: ColorConfig.uiWidgetBackground });
const outVolumeBar = SVG.rect({ "pointer-events": "none", height: "50%", width: "0%", x: "5%", y: "25%", fill: "url('#volumeGrad2')" });
const outVolumeCap = SVG.rect({ "pointer-events": "none", width: "2px", height: "50%", x: "5%", y: "25%", fill: ColorConfig.uiWidgetFocus });
const stop1 = SVG.stop({ "stop-color": "lime", offset: "60%" });
const stop2 = SVG.stop({ "stop-color": "orange", offset: "90%" });
const stop3 = SVG.stop({ "stop-color": "red", offset: "100%" });
const gradient = SVG.linearGradient({ id: "volumeGrad2", gradientUnits: "userSpaceOnUse" }, stop1, stop2, stop3);
const defs = SVG.defs({}, gradient);
const volumeBarContainer = SVG.svg({ style: `touch-action: none; overflow: hidden; margin: auto;`, width: "160px", height: "10px", preserveAspectRatio: "none" },
	defs,
	outVolumeBarBg,
	outVolumeBar,
	outVolumeCap,
);
document.body.appendChild(visualizationContainer);
document.body.appendChild(
		div({style: `flex-shrink: 0; height: 20vh; min-height: 22px; max-height: 70px; display: flex; align-items: center;`},
		playButtonContainer,
		loopButton,
		volumeIcon,
		volumeSlider,
		zoomButton,
		volumeBarContainer,
		oscilloscope.canvas, //make it auto remove itself later
		titleText,
		editLink,
		copyLink,
		shareLink,
		fullscreenLink,
	),
);

// Some browsers have an option to "block third-party cookies" (it's enabled by
// default in icognito Chrome windows) that throws an error on trying to access
// localStorage from cross-domain iframe such as this song player, so wrap the
// access in a try-catch block to ignore the error instead of interrupting
// execution.
function setLocalStorage(key: string, value: string): void {
	try {
		nsLocalStorage_save(key, value);
	} catch (error) {
		// Ignore the error since we can't fix it.
	}
}
function getLocalStorage(key: string): string | null {
	try {
		return nsLocalStorage_get(key);
	} catch (error) {
		// Ignore the error since we can't fix it.
		return null;
	}
}

function removeFromUnorderedArray<T>(array: T[], index: number): void {
	if (array.length < 1) {
		// Don't need to do anything when `array` is empty.
		return;
	}
	if (index === array.length - 1) {
		// Trivial case.
		array.pop();
	} else if (index >= 0 && index < array.length - 1) {
		// The idea here is that we want to remove an element from the array
		// quickly, and the fastest way to do that is to use `array.pop()`. As
		// the name of this function says, we assume `array` to be unordered,
		// so this trick is okay to do.
		const lastElement = array.pop()!;
		array[index] = lastElement;
	}
}

function loadSong(songString: string, reuseParams: boolean): void {
	synth.setSong(songString);
	synth.snapToStart();
	const updatedSongString = synth.song!.toBase64String();
	editLink.href = "../" + (OFFLINE ? "index.html" : "") + "#" + updatedSongString;
	//@jummbus - these lines convert old url vers loaded into the player to the new url ver. The problem is, if special chars are included,
	// they appear to get double-encoded (e.g. the '%' in %20 is encoded again), which breaks the link. Disabled for now until I have a chance
	// to look into it more.
	//const hashQueryParams = new URLSearchParams(reuseParams ? location.hash.slice(1) : "");
	//hashQueryParams.set("song", updatedSongString);
	//location.hash = hashQueryParams.toString();
}

function hashUpdatedExternally(): void {
	let myHash = location.hash;
	if (prevHash == myHash || myHash == "") return;
		
	prevHash = myHash;
		
	if (myHash.charAt(0) == "#") {
		myHash = myHash.substring(1);
	}
		
	
	fullscreenLink.href = location.href;

	// @TODO: This can be moved back into splitting merely on & once samples
	// are reworked so that the URLs don't clash with the overall URL syntax
	// that's assumed to be respected here (and probably elsewhere...)
	for (const parameter of myHash.split(/&(?=[a-z]+=)/g)) {
		let equalsIndex = parameter.indexOf("=");
		if (equalsIndex != -1) {
			let paramName = parameter.substring(0, equalsIndex);
			let value = parameter.substring(equalsIndex + 1);
			switch (paramName) {
				case "song":
					loadSong(value, true);
					if (synth.song) {
						titleText.textContent = synth.song.title;
					}
					break;
				//case "title":
				//	titleText.textContent = decodeURIComponent(value);
				//	break;
				case "loop":
					synth.loopRepeatCount = (value != "1") ? 0 : -1;
					renderLoopIcon();
					break;
			}
		} else {
			loadSong(myHash, false);
		}
	}
		
	renderTimeline();
}

function onWindowResize(): void {
	renderTimeline();
}

let pauseIfAnotherPlayerStartsHandle: ReturnType<typeof setInterval> | null = null;
function pauseIfAnotherPlayerStarts(): void {
	if (!synth.playing) {
		clearInterval(pauseIfAnotherPlayerStartsHandle!);
		return;
	}

	const storedPlayerId: string | null = getLocalStorage("playerId");
	if (storedPlayerId != null && storedPlayerId != id) {
		onTogglePlay();
		renderPlayhead();
		clearInterval(pauseIfAnotherPlayerStartsHandle!);
	}
}

function animate(): void {
	if (synth.playing) {
		animationRequest = requestAnimationFrame(animate);
		renderPlayhead();

		volumeUpdate();
	}
	if (pauseButtonDisplayed != synth.playing) {
		renderPlayButton();
	}

}

function volumeUpdate(): void {
	if (synth.song == null) {
		outVolumeCap.setAttribute("x", "5%");
		outVolumeBar.setAttribute("width", "0%");
		return;
}
	outVolumeHistoricTimer--;
	if (outVolumeHistoricTimer <= 0) {
		outVolumeHistoricCap -= 0.03;
	}
	if (synth.song.outVolumeCap > outVolumeHistoricCap) {
		outVolumeHistoricCap = synth.song.outVolumeCap;
		outVolumeHistoricTimer = 50;
	}

	animateVolume(synth.song.outVolumeCap, outVolumeHistoricCap);

	if (!synth.playing) {
		outVolumeCap.setAttribute("x", "5%");
		outVolumeBar.setAttribute("width", "0%");
	}
}

function animateVolume(useOutVolumeCap: number, historicOutCap: number): void {
	outVolumeBar.setAttribute("width", "" + Math.min(144, useOutVolumeCap * 144));
	outVolumeCap.setAttribute("x", "" + (8 + Math.min(144, historicOutCap * 144)));
}

function onTogglePlay(): void {
	if (synth.song != null) {
		if (animationRequest != null) cancelAnimationFrame(animationRequest);
		animationRequest = null;
		if (synth.playing) {
			synth.pause();
			volumeUpdate();
		} else {
			synth.play();
			setLocalStorage("playerId", id);
			animate();
			clearInterval(pauseIfAnotherPlayerStartsHandle!);
			pauseIfAnotherPlayerStartsHandle = setInterval(pauseIfAnotherPlayerStarts, 100);
		}
	}
	renderPlayButton();
}

function onToggleLoop(): void {
	if (synth.loopRepeatCount == -1) {
		synth.loopRepeatCount = 0;
	} else {
		synth.loopRepeatCount = -1;
	}
	renderLoopIcon();
}

function onVolumeChange(): void {
	setLocalStorage("volume", volumeSlider.value);
	setSynthVolume();
}

function onToggleZoom(): void {
	zoomEnabled = !zoomEnabled;
	renderZoomIcon();
	renderTimeline();
}

function onTimelineMouseDown(event: MouseEvent): void {
	draggingPlayhead = true;
	onTimelineMouseMove(event);
}

function onTimelineMouseMove(event: MouseEvent): void {
	if (!draggingPlayhead) return;
	event.preventDefault();
	onTimelineCursorMove(event.clientX || event.pageX);
}

function onTimelineTouchDown(event: TouchEvent): void {
	draggingPlayhead = true;
	onTimelineTouchMove(event);
}

function onTimelineTouchMove(event: TouchEvent): void {
	onTimelineCursorMove(event.touches[0].clientX);
}

function onTimelineCursorMove(mouseX: number): void {
	if (draggingPlayhead && synth.song != null) {
		const boundingRect = visualizationContainer.getBoundingClientRect();
		synth.playhead = synth.song.barCount * (mouseX - boundingRect.left) / (boundingRect.right - boundingRect.left);
		synth.computeLatestModValues();
		renderPlayhead();
	}
}

function onTimelineCursorUp(): void {
	draggingPlayhead = false;
}

function setSynthVolume(): void {
	const volume = +volumeSlider.value;
	synth.volume = Math.min(1.0, Math.pow(volume / 50.0, 0.5)) * Math.pow(2.0, (volume - 75.0) / 25.0);
}

function renderPlayhead(): void {
	if (synth.song != null) {
		let pos = synth.playhead / synth.song.barCount;
		playhead.style.left = (timelineWidth * pos) + "px";
			
		const boundingRect = visualizationContainer.getBoundingClientRect();
		visualizationContainer.scrollLeft = pos * (timelineWidth - boundingRect.width);

		if (notesFlashWhenPlayed) {
			const playheadBar = Math.floor(synth.playhead);
			const modPlayhead = synth.playhead - playheadBar;
			const partsPerBar = synth.song.beatsPerBar * Config.partsPerBeat;
			const noteFlashElementsForThisBar: SVGPathElement[] = noteFlashElementsPerBar[playheadBar];

			if (noteFlashElementsForThisBar != null && playheadBar !== currentNoteFlashBar) {
				for (var i = currentNoteFlashElements.length - 1; i >= 0; i--) {
					var element = currentNoteFlashElements[i];
					const outsideOfCurrentBar = Number(element.getAttribute("note-bar")) !== playheadBar;
					const isInvisible = element.style.opacity === "0";
					if (outsideOfCurrentBar && isInvisible) {
						removeFromUnorderedArray(currentNoteFlashElements, i);
					}
				}
				for (var i = 0; i < noteFlashElementsForThisBar.length; i++) {
					var element = noteFlashElementsForThisBar[i];
					currentNoteFlashElements.push(element);
				}
			}

			if (currentNoteFlashElements != null) {
				for (var i = 0; i < currentNoteFlashElements.length; i++) {
					var element = currentNoteFlashElements[i];
					const noteStart = Number(element.getAttribute("note-start")) / partsPerBar;
					const noteEnd = Number(element.getAttribute("note-end")) / partsPerBar;
					const noteBar = Number(element.getAttribute("note-bar"));
					if ((modPlayhead >= noteStart) && (noteBar == playheadBar)) {
						const dist = noteEnd - noteStart;
						element.style.opacity = String((1 - (((modPlayhead - noteStart) - (dist / 2)) / (dist / 2))));
					} else {
						element.style.opacity = "0";
					}
				}
			}

			currentNoteFlashBar = playheadBar;
		}
	}
}

function renderTimeline(): void {
	timeline.innerHTML = "";
	if (synth.song == null) return;
		
	const boundingRect = visualizationContainer.getBoundingClientRect();
		
	let timelineHeight: number;
	let windowOctaves: number;
	let windowPitchCount: number;
		
	if (zoomEnabled) {
		timelineHeight = boundingRect.height;
		windowOctaves = Math.max(1, Math.min(Config.pitchOctaves, Math.round(timelineHeight / (12 * 2))));
		windowPitchCount = windowOctaves * 12 + 1;
		const semitoneHeight = (timelineHeight - 1) / windowPitchCount;
		const targetBeatWidth = Math.max(8, semitoneHeight * 4);
		timelineWidth = Math.max(boundingRect.width, targetBeatWidth * synth.song.barCount * synth.song.beatsPerBar);
	} else {
		timelineWidth = boundingRect.width;
		const targetSemitoneHeight = Math.max(1, timelineWidth / (synth.song.barCount * synth.song.beatsPerBar) / 6.0);
		timelineHeight = Math.min(boundingRect.height, targetSemitoneHeight * (Config.maxPitch + 1) + 1);
		windowOctaves = Math.max(3, Math.min(Config.pitchOctaves, Math.round(timelineHeight / (12 * targetSemitoneHeight))));
		windowPitchCount = windowOctaves * 12 + 1;
	}
		
	timelineContainer.style.width = timelineWidth + "px";
	timelineContainer.style.height = timelineHeight + "px";
	timeline.style.width = timelineWidth + "px";
	timeline.style.height = timelineHeight + "px";
		
	const barWidth = timelineWidth / synth.song.barCount;
	const partWidth = barWidth / (synth.song.beatsPerBar * Config.partsPerBeat);

		const wavePitchHeight = (timelineHeight-1) / windowPitchCount;
		const drumPitchHeight =  (timelineHeight-1) / Config.drumCount;
		
	for (let bar = 0; bar < synth.song.barCount + 1; bar++) {
		const color = (bar == synth.song.loopStart || bar == synth.song.loopStart + synth.song.loopLength) ? ColorConfig.loopAccent : ColorConfig.uiWidgetBackground;
			timeline.appendChild(rect({x: bar * barWidth - 1, y: 0, width: 2, height: timelineHeight, fill: color}));
	}
		
	for (let octave = 0; octave <= windowOctaves; octave++) {
			timeline.appendChild(rect({x: 0, y: octave * 12 * wavePitchHeight, width: timelineWidth, height: wavePitchHeight + 1, fill: ColorConfig.tonic, opacity: 0.75}));
	}

	// note flash colors
	let noteFlashColor = "#ffffff";
	let noteFlashColorSecondary = "#ffffff77";
	if (notesFlashWhenPlayed) {
		noteFlashColor = "var(--note-flash)";
		noteFlashColorSecondary = "var(--note-flash-secondary)";
	}

	if (notesFlashWhenPlayed) {
		noteFlashElementsPerBar = [];
		for (let bar = 0; bar < synth.song.barCount; bar++) {
			noteFlashElementsPerBar.push([]);
		}
		currentNoteFlashBar = -1;
	}

	for (let channel = synth.song.channels.length - 1 - synth.song.modChannelCount; channel >= 0; channel--) {

		const isNoise = synth.song.getChannelIsNoise(channel);
		const pitchHeight = isNoise ? drumPitchHeight : wavePitchHeight;
			
		const configuredOctaveScroll = synth.song.channels[channel].octave;
		const newOctaveScroll = Math.max(0, Math.min(Config.pitchOctaves - windowOctaves, Math.ceil(configuredOctaveScroll - windowOctaves * 0.5)));
			
		const offsetY = newOctaveScroll * pitchHeight * 12 + timelineHeight - pitchHeight * 0.5 - 0.5;
			
		for (let bar = 0; bar < synth.song.barCount; bar++) {
			const pattern: Pattern | null = synth.song.getPattern(channel, bar);
			if (pattern == null) continue;
			const offsetX = bar * barWidth;
				
			for (let i = 0; i < pattern.notes.length; i++) {
				const note = pattern.notes[i];
					
				for (const pitch of note.pitches) {
					const d = drawNote(pitch, note.start, note.pins, (pitchHeight + 1) / 2, offsetX, offsetY, partWidth, pitchHeight);
						const noteElement = path({d: d, fill: ColorConfig.getChannelColor(synth.song, synth.song.channels[channel].color, channel, fixChannelColorOrder).primaryChannel});
					if (isNoise) noteElement.style.opacity = String(0.6);
					timeline.appendChild(noteElement);

					if (notesFlashWhenPlayed) {
						const dflash = drawNote(pitch, note.start, note.pins, (pitchHeight + 1) / 2, offsetX, offsetY, partWidth, pitchHeight);
						// const noteFlashColorSecondary = ColorConfig.getComputed("--note-flash-secondary") !== "" ? "var(--note-flash-secondary)" : "#ffffff77";
						// const noteFlashColor = ColorConfig.getComputed("--note-flash") !== "" ? "var(--note-flash)" : "#ffffff77";
						const noteFlashElement = path({d: dflash, fill: (isNoise ? noteFlashColorSecondary : noteFlashColor)});
						noteFlashElement.style.opacity = "0";
						noteFlashElement.setAttribute('note-start', String(note.start));
						noteFlashElement.setAttribute('note-end', String(
							note.end
							));
						noteFlashElement.setAttribute('note-bar', String(bar));
						timeline.appendChild(noteFlashElement);
						const noteFlashElementsForThisBar: SVGPathElement[] = noteFlashElementsPerBar[bar];
						noteFlashElementsForThisBar.push(noteFlashElement);
					}
				}
			}
		}
	}
		
	renderPlayhead();
}

function drawNote(pitch: number, start: number, pins: NotePin[], radius: number, offsetX: number, offsetY: number, partWidth: number, pitchHeight: number): string {
	let d = `M ${offsetX + partWidth * (start + pins[0].time)} ${offsetY - pitch * pitchHeight + radius * (pins[0].size / Config.noteSizeMax)} `; 
	for (let i = 0; i < pins.length; i++) {
		const pin = pins[i];
			const x = offsetX + partWidth * (start + pin.time);
		const y = offsetY - pitchHeight * (pitch + pin.interval);
		const expression = pin.size / Config.noteSizeMax;
		d += `L ${x} ${y - radius * expression} `;
	}
	for (let i = pins.length - 1; i >= 0; i--) {
		const pin = pins[i];
			const x = offsetX + partWidth * (start + pin.time);
		const y = offsetY - pitchHeight * (pitch + pin.interval);
		const expression = pin.size / Config.noteSizeMax;
		d += `L ${x} ${y + radius * expression} `;
	}
	return d;
}

function renderPlayButton(): void {
	if (synth.playing) {
		playButton.classList.remove("playButton");
		playButton.classList.add("pauseButton");
		playButton.title = "Pause (Space)";
		playButton.textContent = "Pause";
	} else {
		playButton.classList.remove("pauseButton");
		playButton.classList.add("playButton");
		playButton.title = "Play (Space)";
		playButton.textContent = "Play";
	}
	pauseButtonDisplayed = synth.playing;
}

function renderLoopIcon(): void {
	loopIcon.setAttribute("fill", (synth.loopRepeatCount == -1) ? ColorConfig.linkAccent : ColorConfig.uiWidgetBackground);
}

function renderZoomIcon(): void {
	zoomIcon.style.color = zoomEnabled ? ColorConfig.linkAccent : ColorConfig.uiWidgetBackground;
}

function onKeyPressed(event: KeyboardEvent): void {
	switch (event.keyCode) {
		case 70: // first bar
			synth.playhead = 0;
			synth.computeLatestModValues();
			renderPlayhead();
			event.preventDefault();
			break;
		case 32: // space
			onTogglePlay();
			synth.computeLatestModValues();
			event.preventDefault();
			break;
		case 219: // left brace
			synth.goToPrevBar();
			synth.computeLatestModValues();
			renderPlayhead();
			event.preventDefault();
			break;
		case 221: // right brace
			synth.goToNextBar();
			synth.computeLatestModValues();
			renderPlayhead();
			event.preventDefault();
			break;
		case 69: // e
		case 80: // p
			if (event.shiftKey) {
				hashUpdatedExternally();
				location.href ="../" + (OFFLINE ? "index.html" : "") + "#" + synth.song!.toBase64String();
				event.preventDefault();
			}
			break;
		case 90: // z
		case 187: // +
		case 61: // Firefox +
		case 171: // Some users have this as +? Hmm.
		case 189: // -
		case 173: // Firefox -
			onToggleZoom();
			break;
		case 76: // l
			onToggleLoop();
			break;
		case 83: // s
			if (event.ctrlKey) {
				shortenUrl();
				event.preventDefault();
			}
			break;
		case 67: // c
			onCopyClicked();
			break;
	}
}

function shortenUrl() {
	hashUpdatedExternally();
	let shortenerStrategy = "https://tinyurl.com/api-create.php?url=";
	const localShortenerStrategy: string | null = nsLocalStorage_get("shortenerStrategySelect");

	// if (localShortenerStrategy == "beepboxnet") shortenerStrategy = "https://www.beepbox.net/api-create.php?url=";
	if (localShortenerStrategy == "isgd") shortenerStrategy = "https://is.gd/create.php?format=simple&url=";

	window.open(shortenerStrategy + encodeURIComponent(new URL("#" + synth.song!.toBase64String(), location.href).href));
}

function onCopyClicked(): void {
	// Set as any to allow compilation without clipboard types (since, uh, I didn't write this bit and don't know the proper types library) -jummbus
	// let nav: any;
	// nav = navigator;
    // the typescript libraries have navigator.clipboard now lets goooooooooo -dragoncoder047

	if (navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard.writeText(location.href).catch(() => {
			window.prompt("Copy to clipboard:", location.href);
		});
		return;
	}
	const textField = document.createElement("textarea");
	textField.textContent = location.href;
	document.body.appendChild(textField);
	textField.select();
	const succeeded = document.execCommand("copy");
	textField.remove();
	if (!succeeded) window.prompt("Copy this:", location.href);
}

function onShareClicked(): void {
	(<any>navigator).share({ url: location.href });
}

	if ( top !== self ) {
	// In an iframe.
	copyLink.style.display = "none";
	shareLink.style.display = "none";
} else {
	// Fullscreen.
	fullscreenLink.style.display = "none";
	if (!("share" in navigator)) shareLink.style.display = "none";
}

if (getLocalStorage("volume") != null) {
	volumeSlider.value = getLocalStorage("volume")!;
}
setSynthVolume();

window.addEventListener("resize", onWindowResize);
window.addEventListener("keydown", onKeyPressed);

timeline.addEventListener("mousedown", onTimelineMouseDown);
window.addEventListener("mousemove", onTimelineMouseMove);
window.addEventListener("mouseup", onTimelineCursorUp);
timeline.addEventListener("touchstart", onTimelineTouchDown);
timeline.addEventListener("touchmove", onTimelineTouchMove);
timeline.addEventListener("touchend", onTimelineCursorUp);
timeline.addEventListener("touchcancel", onTimelineCursorUp);

playButton.addEventListener("click", onTogglePlay);
loopButton.addEventListener("click", onToggleLoop);
volumeSlider.addEventListener("input", onVolumeChange);
zoomButton.addEventListener("click", onToggleZoom);
copyLink.addEventListener("click", onCopyClicked);
shareLink.addEventListener("click", onShareClicked);
window.addEventListener("hashchange", hashUpdatedExternally);

hashUpdatedExternally();
renderLoopIcon();
renderZoomIcon();
renderPlayButton();

// When compiling synth.ts as a standalone module named "beepbox", expose these classes as members to JavaScript:
	export { Channel, Chord, Config, Dictionary, DictionaryArray, Envelope, EnvelopeType, Instrument, InstrumentType, Note, NotePin, Pattern, Synth, Transition };

