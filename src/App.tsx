import './App.css'
import {ReactElement, useEffect, useState} from "react";
import keyboardMockup from './assets/keyboard.png';
import * as Tone from "tone";


// ------------ Synth Functions ------------

function updateSynth() {
    currentSynth.dispose();
    let newSynth: Tone.PolySynth;

    switch (activeEffects.synth) {
        case "synth": {
            newSynth = new Tone.PolySynth(Tone.Synth);
            break;
        }
        case "amsynth": {
            newSynth = new Tone.PolySynth(Tone.AMSynth);
            (newSynth as Tone.PolySynth<Tone.AMSynth>).set({harmonicity: sliderSettings.harmonicity});
            break;
        }
        case "fmsynth": {
            newSynth = new Tone.PolySynth(Tone.FMSynth);
            (newSynth as Tone.PolySynth<Tone.FMSynth>).set({harmonicity: sliderSettings.harmonicity});
            (newSynth as Tone.PolySynth<Tone.FMSynth>).set({modulationIndex: sliderSettings.modulation_index});
            break;
        }
        default: {
            return;
        }
    }

    newSynth.volume.value = -6;

    moduleChain[0] = newSynth;
    currentSynth = newSynth;

    /// SET ALL ENVELOPE AND WAVEFORM AND OSCILLATOR TYPE(AM FM FAT...)
    updateButton();
    connectChain();
    console.log(moduleChain[0]);
} // updates the base synth object with all its parameters

function midiToFreq(number: number) {
    const a = 440;
    return (a/32) * (2 ** ((number - 9) / 12));
}

function noteOn(note: number, velocity: number, octave: number = 0){
    currentSynth.triggerAttack(midiToFreq(note + octave * 12), Tone.now(), velocity / 127);
    console.log(currentSynth.activeVoices);
} // triggers a note

function noteOff(note: number, octave: number = 0) {
    currentSynth.triggerRelease(midiToFreq(note + octave * 12), Tone.now());
} // releases the note

function updateSlider (element: keyof typeof activeEffects) {
    if (activeEffects[element]) {
        console.log(`Updating slider ${element}`);
        if (activeEffects.synth == "amsynth") {
            if (element == "harmonicity") {
                (currentSynth as Tone.PolySynth<Tone.AMSynth>).set({harmonicity: sliderSettings.harmonicity})
            }
        }

        else if (activeEffects.synth == "fmsynth") {
            if (element == "harmonicity") {
                (currentSynth as Tone.PolySynth<Tone.FMSynth>).set({harmonicity: sliderSettings.harmonicity})
            }

            else if (element == "modulation-index") {
                (currentSynth as Tone.PolySynth<Tone.FMSynth>).set({modulationIndex: sliderSettings.modulation_index})
            }
        }
    }
} // uses slider to change the sliderSettings values

function updateButton () {
    let oscillatorType = activeEffects.waveform as EffectTypes;
    if (oscillatorType!= "pulse" && oscillatorType != "pwm") {
        oscillatorType = activeEffects.oscillator_type+oscillatorType as EffectTypes;
    }
    currentSynth.set({oscillator: {type: oscillatorType as EffectTypes}});
} // sets the oscillator to the chosen type from buttons



// ------------ Module Chain Functions ------------

function connectChain() {
    for (let i = 0; i < moduleChain.length - 1; i++) {
        const first = moduleChain[i];
        const second = moduleChain[i+1];
        first.disconnect();
        first.connect(second);
    }
    moduleChain[moduleChain.length-1].toDestination();
}

function addModule (moduleType: string) {
    let module: Tone.ToneAudioNode;

    switch (moduleType) {
        case "delay":
            module = new Tone.Delay(sliderSettings.delay);
            break;
        case "reverb":
            module = new Tone.Reverb(sliderSettings.reverb);
            break;
        case "feedback":
            module = new Tone.FeedbackDelay(sliderSettings.feedback1, sliderSettings.feedback2);
            break;
        case "pingpong":
            module = new Tone.PingPongDelay(sliderSettings.pingpong1, sliderSettings.pingpong2);
            break;
        case "chorus":
            module = new Tone.Chorus(1.5, sliderSettings.chorus1, sliderSettings.chorus2);
            break;
        case "distortion":
            module = new Tone.Distortion(sliderSettings.distortion);
            break;
        case "wah":
            module = new Tone.AutoWah(100, sliderSettings.wah);
            break;
        case "phaser":
            module = new Tone.Phaser(sliderSettings.phaser1, sliderSettings.phaser2);
            break;
        case "widener":
            module = new Tone.StereoWidener(sliderSettings.widener);
            break;
        case "vibrato":
            module = new Tone.Vibrato(sliderSettings.vibrato1, sliderSettings.vibrato2);
            break;
        case "bitcrusher":
            module = new Tone.BitCrusher(sliderSettings.bitcrusher);
            break;
        case "chebyshev":
            module = new Tone.Chebyshev(sliderSettings.chebyshev);
            break;
        default:
            console.warn(`Unknown module type: ${moduleType}`)
            return;
    }
    existingModules.push({id: moduleType, instance: module});

    moduleChain.pop();
    moduleChain.push(module);
    moduleChain.push(limiter);

    connectChain();
    console.log(moduleChain);
}

function removeModule (moduleType: string) {
    const moduleIndex = existingModules.findIndex(module => module.id == moduleType);
    if (moduleIndex === -1) {
        console.warn(`Module ${moduleType} not found`);
        return;
    }

    const { instance } = existingModules[moduleIndex];
    existingModules.splice(moduleIndex, 1);

    const chainIndex = moduleChain.indexOf(instance);
    if (chainIndex !== -1) {
        moduleChain[chainIndex].dispose();
        moduleChain.splice(chainIndex, 1);
    }

    connectChain();
    console.log(moduleChain);
}



// ------------ API Functions ------------

function updateDevices(event: MIDIConnectionEvent) {
    console.log(`Name: ${event.port?.name}$, Brand: ${event.port?.manufacturer}$, State: ${event.port?.state}$, Type: ${event.port?.type}$`);
}

function handleInput(input: MIDIMessageEvent) {
    if (input.data) {
        const command = input.data[0];
        const note = input.data[1];
        if (command == 144) {
            const velocity = input.data[2];
            if (velocity > 0) {
                noteOn(note, velocity);
            }
        } else if (command == 128) {
            noteOff(note);
        }
    }
}

function success(midiAccess: MIDIAccess) {
    console.log("success");
    midiAccess.addEventListener('statechange', (e) => updateDevices(e as MIDIConnectionEvent));

    const inputs = midiAccess.inputs;

    inputs.forEach((input) => {
        input.addEventListener('midimessage', handleInput)
    });
}

function failure() {
    console.log("Failed ");
}

function navigatorBegin() {
    console.log("navigatorBegin");
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(success, failure);
    }
}


type EffectTypes =
    "sine"
    | "square"
    | "sawtooth"
    | "triangle"

    | "fatsine"
    | "fatsquare"
    | "fatsawtooth"
    | "fattriangle"

    | "fmsine"
    | "fmsquare"
    | "fmsawtooth"
    | "fmtriangle"

    | "amsine"
    | "amsquare"
    | "amsawtooth"
    | "amtriangle"

    | "pulse"
    | "pwm";

const keyToNote: { [key: string]: number } = {
    q: 48, // C3
    2: 49, // C#3
    w: 50, // D3
    3: 51, // D#3
    e: 52, // E3
    r: 53, // F3
    5: 54, // F#3
    t: 55, // G3
    6: 56, // G#3
    y: 57, // A3
    7: 58, // A#3
    u: 59, // B3
    i: 60, // Middle C4
    9: 61, // C#4
    o: 62, // B4
    0: 63, // B#4
    p: 64, // E4
    z: 65, // F4
    s: 66, // F#4
    x: 67, // G4
    d: 68, // G#4
    c: 69, // A4
    f: 70, // A#4
    v: 71, // B4
    b: 72, // C5
    h: 73, // C#5
    n: 74, // D5
    j: 75, // D#5
    m: 76, // E5
};

let currentSynth = new Tone.PolySynth();
currentSynth.volume.value = -6;

const limiter = new Tone.Limiter(-6);

const moduleChain: Tone.ToneAudioNode[] = [currentSynth, limiter];

const existingModules: { id: string, instance: Tone.ToneAudioNode }[] = [];

const activeEffects = {
    "synth": "synth",
    "waveform": "sine",
    "oscillator_type": "",
    "harmonicity": true,
    "modulation-index": true,
    "highpass": false,
    "lowpass": false,
    "bandpass": false,
    "notch": false,
    "delay": false,
    "reverb": false,
    "feedback": false,
    "pingpong": false,
    "chorus": false,
    "distortion": false,
    "wah": false,
    "phaser": false,
    "widener": false,
    "vibrato": false,
    "bitcrusher": false,
    "chebyshev": false,
    "partials": false
};

const sliderSettings = {
    "harmonicity": 3,
    "modulation_index": 10,
    "attack": 0.005,
    "decay": 0.1,
    "sustain": 0.3,
    "release": 1,
    "highpass": 1000,
    "lowpass": 1000,
    "bandpass": 1000,
    "notch": 1000,
    "delay": 1,
    "reverb": 1,
    "feedback1": 1,
    "feedback2": 0.5,
    "pingpong1": 1,
    "pingpong2": 0.5,
    "chorus1": 10,
    "chorus2": 1,
    "distortion": 0.5,
    "wah": 1,
    "phaser1": 1,
    "phaser2": 1,
    "widener": 0.5,
    "vibrato1": 5,
    "vibrato2": 0.1,
    "bitcrusher": 4,
    "chebyshev": 1
};


navigatorBegin();

connectChain();

updateSynth();

function App(): ReactElement {
    const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
    const [octave, setOctave] = useState(0);
    const [isMIDICompatible, setIsMIDICompatible] = useState(true);


    useEffect(() => {
        if (!navigator.requestMIDIAccess) {
            setIsMIDICompatible(false);
            console.error("Web MIDI API is not supported in this browser.");
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key == 'ArrowDown') {
                console.log("octave down");
                setOctave(octave - 1);
            } else if (event.key == 'ArrowUp') {
                setOctave(octave + 1);
            } else {
                const note = keyToNote[event.key];
                if (note && !pressedKeys.has(event.key)) {
                    setPressedKeys((prev) => new Set(prev).add(event.key));
                    noteOn(note, 127, octave);
                }
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key != 'ArrowDown' && event.key != 'ArrowUp') {
                const note = keyToNote[event.key];
                if (note) {
                    setPressedKeys((prev) => {
                        const updated = new Set(prev);
                        updated.delete(event.key);
                        return updated;
                    });
                    noteOff(note, octave);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [pressedKeys, octave]);


    return (
        <div id={"body"}>
            <h1>SynthWeb</h1>
            <h2>Modular Synthesiser</h2>
            <div className="keyboard-mockup">
                <img
                    src={keyboardMockup}
                    alt="Keyboard Mockup"
                    style={{
                        width: '100%',
                        maxWidth: '800px',
                        height: 'auto',
                        display: 'block',
                        margin: '0 auto',
                    }}
                />
            </div>
            <div className={"card"}>

                <div className={"vertical"} id={"synth-column"}>
                    <div className={"column-title"}>
                        <h3>Synth</h3>
                    </div>
                    <div className={"vertical"} id={"synth-choices"}>
                        <button onClick={
                            () => {
                                activeEffects.synth = "synth";
                                updateSynth();
                            }
                        }>Classic</button>
                        <button onClick={
                            () => {
                                activeEffects.synth = "amsynth";
                                updateSynth();
                            }
                        }>AMSynth</button>
                        <button onClick={
                            () => {
                                activeEffects.synth = "fmsynth";
                                updateSynth();
                            }
                        }>FMSynth</button>
                        <input
                            type={"range"}
                            id={"harmonicity-slider"}
                            min={"1"}
                            max={"10"}
                            defaultValue={sliderSettings.harmonicity}
                            step={"1"}
                            onChange={
                                (e) =>  {
                                    sliderSettings.harmonicity = parseFloat(e.target.value);
                                    updateSlider("harmonicity");
                                }
                            }
                        />
                        <input
                            type={"range"}
                            id={"modulation-index-slider"}
                            min={"1"}
                            max={"20"}
                            defaultValue={sliderSettings.modulation_index}
                            step={"1"}
                            onChange={
                                (e) =>  {
                                    sliderSettings.modulation_index = parseFloat(e.target.value);
                                    updateSlider("modulation-index");
                                }
                            }
                        />
                    </div>
                </div>
                <div className={"vertical"} id={"waveform-column"}>
                    <div className={"column-title"}>
                        <h3>Waveform</h3>
                    </div>
                    <div className={"vertical"} id={"waveform-choices"}>
                        <button onClick={
                            () => {
                                activeEffects.waveform = "sine";
                                updateButton();
                            }
                        }>Sine</button>
                        <button onClick={
                            () => {
                                activeEffects.waveform = "square";
                                updateButton();
                            }
                        }>Square</button>
                        <button onClick={
                            () => {
                                activeEffects.waveform = "sawtooth";
                                updateButton();
                            }
                        }>Saw</button>
                        <button onClick={
                            () => {
                                activeEffects.waveform = "triangle";
                                updateButton();
                            }
                        }>Triangle</button>
                        <button onClick={
                            () => {
                                activeEffects.waveform = "pulse";
                                updateButton();
                            }
                        }>Pulse</button>
                        <button onClick={
                            () => {
                                activeEffects.waveform = "pwm";
                                updateButton();
                            }
                        }>PWM</button>
                    </div>
                    <div className={"vertical"} id={"envelope-choices"}>
                        <div className={"effect"}>
                            <label>Attack</label>
                            <input
                                type={"range"}
                                id={"attack-slider"}
                                min={"0.005"}
                                max={"3"}
                                defaultValue={sliderSettings.attack}
                                step={"0.001"}
                                onChange={
                                    (e) => currentSynth.set({
                                        envelope: {
                                            attack: parseFloat(e.target.value)
                                        }
                                    })
                                }
                            />
                        </div>
                        <div className={"effect"}>
                            <label>Decay</label>
                            <input
                                type={"range"}
                                id={"decay-slider"}
                                min={"0.1"}
                                max={"3"}
                                defaultValue={sliderSettings.decay}
                                step={"0.01"}
                                onChange={(e) => {
                                    currentSynth.set({
                                        envelope: {
                                            decay: parseFloat(e.target.value)
                                        }
                                    })
                                }
                            }
                            />
                        </div>
                        <div className={"effect"}>
                            <label>Sustain</label>
                            <input
                                type={"range"}
                                id={"sustain-slider"}
                                min={"0"}
                                max={"1"}
                                defaultValue={sliderSettings.sustain}
                                step={"0.01"}
                                onChange={(e) => currentSynth.set({envelope: {sustain: parseFloat(e.target.value)}})}
                            />
                        </div>
                        <div className={"effect"}>
                            <label>Release</label>
                            <input
                                type={"range"}
                                id={"release-slider"}
                                min={"0.01"}
                                max={"3"}
                                defaultValue={sliderSettings.release}
                                step={"0.01"}
                                onChange={(e) => currentSynth.set({envelope: {release: parseFloat(e.target.value)}})}
                            />
                        </div>

                        <button onClick={
                            () => {
                                activeEffects.oscillator_type = "";
                                updateButton();
                            }
                        }>NONE</button>
                        <button onClick={
                            () => {
                                activeEffects.oscillator_type = "am";
                                updateButton();
                            }
                        }>AM</button>
                        <button onClick={
                            () => {
                                activeEffects.oscillator_type = "fm";
                                updateButton();
                            }
                        }>FM</button>
                        <button onClick={
                            () => {
                                activeEffects.oscillator_type = "fat";
                                updateButton();
                            }
                        }>FAT</button>
                    </div>
                </div>
                <div className={"vertical"} id={"effects-column"}>
                    <div className={"column-title"}>
                        <h3>Modular Effects</h3>
                    </div>
                    <div className={"horizontal"}>
                        <div className={"vertical"}>
                            <div className={"vertical"}>
                                <div className={"effect"}>
                                    <input
                                        type={"checkbox"}
                                        id={"highpass-toggle"}
                                    />
                                    <label>Highpass</label>
                                    <input
                                        type={"range"}
                                        id={"highpass-slider"}
                                        min={"20"}
                                        max={"5000"}
                                        defaultValue={sliderSettings.highpass}
                                        step={"1"}
                                    />
                                </div>
                                <div className={"effect"}>
                                    <input
                                        type={"checkbox"}
                                        id={"lowpass-toggle"}
                                    />
                                    <label>Lowpass</label>
                                    <input
                                        type={"range"}
                                        id={"lowpass-slider"}
                                        min={"20"}
                                        max={"5000"}
                                        defaultValue={sliderSettings.lowpass}
                                        step={"1"}
                                    />
                                </div>
                                <div className={"effect"}>
                                    <input
                                        type={"checkbox"}
                                        id={"bandpass-toggle"}
                                    />
                                    <label>Bandpass</label>
                                    <input
                                        type={"range"}
                                        id={"bandpass-slider"}
                                        min={"20"}
                                        max={"5000"}
                                        defaultValue={sliderSettings.bandpass}
                                        step={"1"}
                                    />
                                </div>
                                <div className={"effect"}>
                                    <input
                                        type={"checkbox"}
                                        id={"notch-toggle"}
                                    />
                                    <label>Notch</label>
                                    <input
                                        type={"range"}
                                        id={"notch-slider"}
                                        min={"20"}
                                        max={"5000"}
                                        defaultValue={sliderSettings.notch}
                                        step={"1"}
                                    />
                                </div>
                            </div>
                            <div className={"vertical"}>
                                <div className={"effect"}>
                                    <input
                                        type={"checkbox"}
                                        id={"delay-toggle"}
                                        onChange = {
                                            (e) => {
                                                if (e.target.checked) {
                                                    addModule("delay");
                                                }
                                                else {
                                                    removeModule("delay");
                                                }
                                            }
                                        }
                                    />
                                    <label>Delay</label>
                                    <input
                                        type={"range"}
                                        id={"delay-slider"}
                                        min={"0"}
                                        max={"3"}
                                        defaultValue={sliderSettings.delay}
                                        step={"0.01"}
                                    />
                                </div>
                                <div className={"effect"}>
                                    <input
                                        type={"checkbox"}
                                        id={"reverb-toggle"}
                                    />
                                    <label>Reverb</label>
                                    <input
                                        type={"range"}
                                        id={"reverb-slider"}
                                        min={"0"}
                                        max={"5"}
                                        defaultValue={sliderSettings.reverb}
                                        step={"0.01"}
                                    />
                                </div>
                                <div className={"effect"}>
                                    <input
                                        type={"checkbox"}
                                        id={"feedback-toggle"}
                                    />
                                    <label>Feedback</label>
                                    <div className={"vertical"}>
                                        <input
                                            type={"range"}
                                            id={"feedback-slider-1"}
                                            min={"0"}
                                            max={"2"}
                                            defaultValue={sliderSettings.feedback1}
                                            step={"0.01"}
                                        />
                                        <input
                                            type={"range"}
                                            id={"feedback-slider-2"}
                                            min={"0"}
                                            max={"1"}
                                            defaultValue={sliderSettings.feedback2}
                                            step={"0.01"}
                                        />
                                    </div>
                                </div>
                                <div className={"effect"}>
                                    <input
                                        type={"checkbox"}
                                        id={"pingpong-toggle"}
                                    />
                                    <label>PingPong</label>
                                    <div className={"vertical"}>
                                        <input
                                            type={"range"}
                                            id={"pingpong-slider-1"}
                                            min={"0"}
                                            max={"2"}
                                            defaultValue={sliderSettings.pingpong1}
                                            step={"0.01"}
                                        />
                                        <input
                                            type={"range"}
                                            id={"pingpong-slider-2"}
                                            min={"0"}
                                            max={"1"}
                                            defaultValue={sliderSettings.pingpong2}
                                            step={"0.01"}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={"vertical"}>
                            <div className={"effect"}>
                                <input
                                    type={"checkbox"}
                                    id={"chorus-toggle"}
                                />
                                <label>Chorus</label>
                                <div className={"vertical"}>
                                    <input
                                        type={"range"}
                                        id={"chorus-slider-1"}
                                        min={"0"}
                                        max={"100"}
                                        defaultValue={sliderSettings.chorus1}
                                        step={"1"}
                                    />
                                    <input
                                        type={"range"}
                                        id={"chorus-slider-2"}
                                        min={"0"}
                                        max={"5"}
                                        defaultValue={sliderSettings.chorus2}
                                        step={"0.1"}
                                    />
                                </div>
                            </div>
                            <div className={"effect"}>
                                <input
                                    type={"checkbox"}
                                    id={"distortion-toggle"}
                                />
                                <label>Distortion</label>
                                <input
                                    type={"range"}
                                    id={"distortion-slider"}
                                    min={"0"}
                                    max={"1"}
                                    defaultValue={sliderSettings.distortion}
                                    step={"0.01"}
                                />
                            </div>
                            <div className={"effect"}>
                                <input
                                    type={"checkbox"}
                                    id={"wah-toggle"}
                                />
                                <label>Wah</label>
                                <input
                                    type={"range"}
                                    id={"wah-slider"}
                                    min={"0"}
                                    max={"10"}
                                    defaultValue={sliderSettings.wah}
                                    step={"0.1"}
                                />
                            </div>
                            <div className={"effect"}>
                                <input
                                    type={"checkbox"}
                                    id={"phaser-toggle"}
                                />
                                <label>Phaser</label>
                                <div className={"vertical"}>
                                    <input
                                        type={"range"}
                                        id={"phaser-slider-1"}
                                        min={"0"}
                                        max={"3"}
                                        defaultValue={sliderSettings.phaser1}
                                        step={"0.01"}
                                    />
                                    <input
                                        type={"range"}
                                        id={"phaser-slider-2"}
                                        min={"0"}
                                        max={"10"}
                                        defaultValue={sliderSettings.phaser2}
                                        step={"0.1"}
                                    />
                                </div>
                            </div>
                            <div className={"effect"}>
                                <input
                                    type={"checkbox"}
                                    id={"widener-toggle"}
                                />
                                <label>Widener</label>
                                <input
                                    type={"range"}
                                    id={"widener-slider"}
                                    min={"0"}
                                    max={"1"}
                                    defaultValue={sliderSettings.widener}
                                    step={"0.01"}
                                />
                            </div>
                            <div className={"effect"}>
                                <input
                                    type={"checkbox"}
                                    id={"vibrato-toggle"}
                                />
                                <label>Vibrato</label>
                                <div className={"vertical"}>
                                    <input
                                        type={"range"}
                                        id={"vibrato-slider-1"}
                                        min={"2"}
                                        max={"20"}
                                        defaultValue={sliderSettings.vibrato1}
                                        step={"0.01"}
                                    />
                                    <input
                                        type={"range"}
                                        id={"vibrato-slider-2"}
                                        min={"0"}
                                        max={"1"}
                                        defaultValue={sliderSettings.vibrato2}
                                        step={"0.01"}
                                    />
                                </div>
                            </div>
                            <div className={"effect"}>
                                <input
                                    type={"checkbox"}
                                    id={"bitcrusher-toggle"}
                                />
                                <label>Bit Crusher</label>
                                <input
                                    type={"range"}
                                    id={"bitcrusher-slider"}
                                    min={"1"}
                                    max={"8"}
                                    defaultValue={sliderSettings.bitcrusher}
                                    step={"1"}
                                />
                            </div>
                            <div className={"effect"}>
                                <input
                                    type={"checkbox"}
                                    id={"chebyshev-toggle"}
                                />
                                <label>Chebyshev</label>
                                <input
                                    type={"range"}
                                    id={"chebyshev-slider"}
                                    min={"1"}
                                    max={"100"}
                                    defaultValue={sliderSettings.chebyshev}
                                    step={"1"}
                                />
                            </div>
                            <div className={"effect"}>
                                <input
                                    type={"checkbox"}
                                    id={"partials-toggle"}
                                />
                                <label>Partials</label>
                                <div className={"vertical"}>
                                    <input
                                        type={"range"}
                                        id={"partials-slider-1"}
                                        min={"0"}
                                        max={"1"}
                                        defaultValue={"1"}
                                        step={"0.01"}
                                    />
                                    <input
                                        type={"range"}
                                        id={"partials-slider-2"}
                                        min={"0"}
                                        max={"1"}
                                        defaultValue={"1"}
                                        step={"0.01"}
                                    />
                                    <input
                                        type={"range"}
                                        id={"partials-slider-3"}
                                        min={"0"}
                                        max={"1"}
                                        defaultValue={"1"}
                                        step={"0.01"}
                                    />
                                    <input
                                        type={"range"}
                                        id={"partials-slider-4"}
                                        min={"0"}
                                        max={"1"}
                                        defaultValue={"1"}
                                        step={"0.01"}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div>
                {!isMIDICompatible && (
                    <div className="midi_warning">
                        <p>
                            This browser does not support the Web MIDI API.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default App;
