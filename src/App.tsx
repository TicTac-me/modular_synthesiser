import './App.css'
import {ReactElement, useEffect, useState} from "react";
import keyboardMockup from './assets/keyboard_mockup.png';
import * as Tone from "tone";
import $ from "jquery";



// ------------ Synth Functions ------------

function updateSynth() {
    currentSynth.dispose();
    let newSynth: Tone.PolySynth;

    switch (synthType.synth) {
        case "synth": {
            newSynth = new Tone.PolySynth(Tone.Synth);
            break;
        }
        case "amsynth": {
            newSynth = new Tone.PolySynth(Tone.AMSynth);
            (newSynth as Tone.PolySynth<Tone.AMSynth>).set({harmonicity: synthType.harmonicity});
            break;
        }
        case "fmsynth": {
            newSynth = new Tone.PolySynth(Tone.FMSynth);
            (newSynth as Tone.PolySynth<Tone.FMSynth>).set({harmonicity: synthType.harmonicity});
            (newSynth as Tone.PolySynth<Tone.FMSynth>).set({modulationIndex: synthType.modulation_index});
            break;
        }
        default: {
            return;
        }
    }

    newSynth.volume.value = -6;

    moduleChain[0] = newSynth;
    currentSynth = newSynth;


    setEnvelope();
    resetPartials();
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

function updateSynthSlider (element: keyof typeof synthType) {
    console.log(`Updating slider ${element}`);
    if (synthType.synth == "amsynth") {
        if (element == "harmonicity") {
            (currentSynth as Tone.PolySynth<Tone.AMSynth>).set({harmonicity: synthType.harmonicity})
        }
    }

    else if (synthType.synth == "fmsynth") {
        if (element == "harmonicity") {
            (currentSynth as Tone.PolySynth<Tone.FMSynth>).set({harmonicity: synthType.harmonicity})
        }

        else if (element == "modulation_index") {
            (currentSynth as Tone.PolySynth<Tone.FMSynth>).set({modulationIndex: synthType.modulation_index})
        }
    }
} // updates the sliders associated to the synth type

function updateEnvelope (element: EnvelopeTypes) {
    switch (element) {
        case "attack": {
            currentSynth.set({envelope: {attack: synthEnvelope[element]}});
            break;
        }
        case "decay": {
            currentSynth.set({envelope: {decay: synthEnvelope[element]}});
            break;
        }
        case "sustain": {
            currentSynth.set({envelope: {sustain: synthEnvelope[element]}});
            break;
        }
        case "release": {
            currentSynth.set({envelope: {release: synthEnvelope[element]}});
            break;
        }
        default: {
            return;
        }
    }
} // updates the synth's envelope

function setEnvelope () {
    currentSynth.set({
        envelope: {
            attack: synthEnvelope.attack,
            decay: synthEnvelope.decay,
            sustain: synthEnvelope.sustain,
            release: synthEnvelope.release
        }
    })
}

function setPartials () {
    currentSynth.set({
        oscillator: {
            partials: [
                synthType.partials1,
                synthType.partials2,
                synthType.partials3,
                synthType.partials4
            ]
        }
    })
}

function resetPartials() {
    synthType.partials1 = 0;
    synthType.partials2 = 0;
    synthType.partials3 = 0;
    synthType.partials4 = 0;

    $("#partials-slider-1").val("0");
    $("#partials-slider-2").val("0");
    $("#partials-slider-3").val("0");
    $("#partials-slider-4").val("0");

    setPartials();
}

function updateButton () {
    let oscillatorType = synthType.waveform as EffectTypes;
    if (oscillatorType!= "pulse" && oscillatorType != "pwm") {
        oscillatorType = synthType.oscillator_type+oscillatorType as EffectTypes;
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
        if (isDelayType(second)) {
            let y=i+2;
            while (isDelayType(moduleChain[y])) {
                y+=1;
            }
            first.connect(moduleChain[y]);
        }
    }
    moduleChain[moduleChain.length-1].toDestination();
}

function addModule (moduleType: string) {
    let module: Tone.ToneAudioNode;

    switch (moduleType) {
        case "highpass":
            module = new Tone.Filter(effectValues.highpass, "highpass");
            break;
        case "lowpass":
            module = new Tone.Filter(effectValues.lowpass, "lowpass");
            break;
        case "bandpass":
            module = new Tone.Filter(effectValues.bandpass, "bandpass");
            break;
        case "notch":
            module = new Tone.Filter(effectValues.notch, "notch");
            break;
        case "delay":
            module = new Tone.Delay(effectValues.delay);
            break;
        case "reverb":
            module = new Tone.Reverb(effectValues.reverb);
            break;
        case "feedback":
            module = new Tone.FeedbackDelay(effectValues.feedback1, effectValues.feedback2);
            break;
        case "pingpong":
            module = new Tone.PingPongDelay(effectValues.pingpong1, effectValues.pingpong2);
            break;
        case "chorus":
            module = new Tone.Chorus(1.5, effectValues.chorus1, effectValues.chorus2);
            break;
        case "distortion":
            module = new Tone.Distortion(effectValues.distortion);
            break;
        case "wah":
            module = new Tone.AutoWah(100, effectValues.wah);
            break;
        case "phaser":
            module = new Tone.Phaser(effectValues.phaser1, effectValues.phaser2);
            break;
        case "widener":
            module = new Tone.StereoWidener(effectValues.widener);
            break;
        case "vibrato":
            module = new Tone.Vibrato(effectValues.vibrato1, effectValues.vibrato2);
            break;
        case "bitcrusher":
            module = new Tone.BitCrusher(effectValues.bitcrusher);
            break;
        case "chebyshev":
            module = new Tone.Chebyshev(effectValues.chebyshev);
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
        instance.dispose();
        moduleChain.splice(chainIndex, 1);
    }

    connectChain();
    console.log(moduleChain);
}

function isDelayType(module: Tone.ToneAudioNode) {
    // return typeof module == typeof Tone.Delay || typeof module == typeof Tone.FeedbackDelay || typeof module == typeof Tone.PingPongDelay;
    const delayNames = ["Delay", "FeedbackDelay", "PingPongDelay"]
    return delayNames.includes(module.name);
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

function startup() {

    navigatorBegin();

    connectChain();

    updateSynth();
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

type EnvelopeTypes =
    "attack"
    | "decay"
    | "sustain"
    | "release";

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



let firstTimeLoading = true;

Tone.setContext(new Tone.Context({ latencyHint: 'interactive' }));
Tone.getContext().lookAhead = 0.01;

let currentSynth = new Tone.PolySynth();
currentSynth.volume.value = -6;

const limiter = new Tone.Limiter(-6);

const moduleChain: Tone.ToneAudioNode[] = [currentSynth, limiter];

const existingModules: { id: string, instance: Tone.ToneAudioNode }[] = [];


const synthType = {
    "synth": "synth",
    "waveform": "sine",
    "oscillator_type": "",
    "harmonicity": 3,
    "modulation_index": 10,
    "partials1": 0,
    "partials2": 0,
    "partials3": 0,
    "partials4": 0
}

const synthEnvelope = {
    "attack": 0.005,
    "decay": 0.1,
    "sustain": 0.3,
    "release": 1,
}


const effectValues = {
    "highpass": 1000,
    "lowpass": 1000,
    "bandpass": 1000,
    "notch": 1000,
    "delay": 0.5,
    "reverb": 1,
    "feedback1": 0.5,
    "feedback2": 0.5,
    "pingpong1": 0.5,
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

startup();

function App(): ReactElement {
    const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
    const [octave, setOctave] = useState(0);
    const [isMIDICompatible, setIsMIDICompatible] = useState(true);


    if (firstTimeLoading) {
        const synthBox: HTMLInputElement = document.getElementById("synth1") as HTMLInputElement;
        const waveformBox: HTMLInputElement = document.getElementById("waveform1") as HTMLInputElement;
        const modifierBox: HTMLInputElement = document.getElementById("modifier1") as HTMLInputElement;
        if (synthBox) {
            synthBox.checked = true;
            waveformBox.checked = true;
            modifierBox.checked = true;
            firstTimeLoading = false;
        }
    }

    useEffect(() => {
        if (!navigator.requestMIDIAccess) {
            setIsMIDICompatible(false);
            console.error("Web MIDI API is not supported in this browser.");
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key == 'ArrowDown') {
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

                        <input type="radio" id="synth1" name="synth" value="1" onClick={
                            () => {
                                synthType.synth = "synth";
                                updateSynth();
                            }
                        }/>
                        <label htmlFor="synth1" className="radio-label">Classic</label>

                        <input type="radio" id="synth2" name="synth" value="2" onClick={
                            () => {
                                synthType.synth = "amsynth";
                                updateSynth();
                            }
                        }/>
                        <label htmlFor="synth2" className="radio-label">AMSynth</label>

                        <input type="radio" id="synth3" name="synth" value="3" onClick={
                            () => {
                                synthType.synth = "fmsynth";
                                updateSynth();
                            }
                        }/>
                        <label htmlFor="synth3" className="radio-label">FMSynth</label>


                        <label className={"small-title"}>Harmonicity</label>
                        <input
                            type={"range"}
                            id={"harmonicity-slider"}
                            min={"1"}
                            max={"10"}
                            defaultValue={synthType.harmonicity}
                            step={"1"}
                            onChange={
                                (e) => {
                                    synthType.harmonicity = parseFloat(e.target.value);
                                    updateSynthSlider("harmonicity");
                                }
                            }
                        />
                        <input
                            type={"range"}
                            id={"modulation-index-slider"}
                            min={"1"}
                            max={"20"}
                            defaultValue={synthType.modulation_index}
                            step={"1"}
                            onChange={
                                (e) => {
                                    synthType.modulation_index = parseFloat(e.target.value);
                                    updateSynthSlider("modulation_index");
                                }
                            }
                        />

                        <label className={"small-title"}>Partials</label>

                        <div className={"reset-button"} onClick={
                            () => {
                                // resetPartials();
                                updateSynth();
                            }
                        }>
                            <label id={"reset-label"}>Reset</label>
                        </div>

                        <div className={"vertical"}>
                            <input
                                type={"range"}
                                id={"partials-slider-1"}
                                min={"0"}
                                max={"1"}
                                defaultValue={synthType.partials1}
                                step={"0.01"}
                                onChange={
                                    (e) => {
                                        synthType.partials1 = parseFloat(e.target.value);
                                        setPartials();
                                    }
                                }
                            />
                            <input
                                type={"range"}
                                id={"partials-slider-2"}
                                min={"0"}
                                max={"1"}
                                defaultValue={synthType.partials2}
                                step={"0.01"}
                                onChange={
                                    (e) => {
                                        synthType.partials2 = parseFloat(e.target.value);
                                        setPartials();
                                    }
                                }
                            />
                            <input
                                type={"range"}
                                id={"partials-slider-3"}
                                min={"0"}
                                max={"1"}
                                defaultValue={synthType.partials3}
                                step={"0.01"}
                                onChange={
                                    (e) => {
                                        synthType.partials3 = parseFloat(e.target.value);
                                        setPartials();
                                    }
                                }
                            />
                            <input
                                type={"range"}
                                id={"partials-slider-4"}
                                min={"0"}
                                max={"1"}
                                defaultValue={synthType.partials4}
                                step={"0.01"}
                                onChange={
                                    (e) => {
                                        synthType.partials4 = parseFloat(e.target.value);
                                        setPartials();
                                    }
                                }
                            />
                        </div>
                    </div>
                </div>
                <div className={"vertical"} id={"waveform-column"}>
                    <div className={"column-title"}>
                    <h3>Waveform</h3>
                    </div>
                    <div className={"vertical"} id={"waveform-choices"}>
                        <input type="radio" id="waveform1" name="waveform" value="1" onClick={
                            () => {
                                synthType.waveform = "sine";
                                updateSynth();
                                // updateButton();
                            }
                        }/>
                        <label htmlFor="waveform1" className="radio-label">Sine</label>

                        <input type="radio" id="waveform2" name="waveform" value="2" onClick={
                            () => {
                                synthType.waveform = "square";
                                updateSynth();
                                // updateButton();
                            }
                        }/>
                        <label htmlFor="waveform2" className="radio-label">Square</label>

                        <input type="radio" id="waveform3" name="waveform" value="3" onClick={
                            () => {
                                synthType.waveform = "sawtooth";
                                updateSynth();
                                // updateButton();
                            }
                        }/>
                        <label htmlFor="waveform3" className="radio-label">Sawtooth</label>

                        <input type="radio" id="waveform4" name="waveform" value="4" onClick={
                            () => {
                                synthType.waveform = "triangle";
                                updateSynth();
                                // updateButton();
                            }
                        }/>
                        <label htmlFor="waveform4" className="radio-label">Triangle</label>

                        <input type="radio" id="waveform5" name="waveform" value="5" onClick={
                            () => {
                                synthType.waveform = "pulse";
                                updateSynth();
                                // updateButton();
                            }
                        }/>
                        <label htmlFor="waveform5" className="radio-label">Pulse</label>

                        <input type="radio" id="waveform6" name="waveform" value="6" onClick={
                            () => {
                                synthType.waveform = "pwm";
                                updateSynth();
                                // updateButton();
                            }
                        }/>
                        <label htmlFor="waveform6" className="radio-label">PWM</label>

                    </div>
                    <div className={"vertical"} id={"envelope-choices"}>
                        <div className={"effect2"}>
                            <label>Attack</label>
                            <div className={"sliderContainer"}>
                                <input
                                    type={"range"}
                                    id={"attack-slider"}
                                    min={"0.005"}
                                    max={"3"}
                                    defaultValue={synthEnvelope.attack}
                                    step={"0.005"}
                                    onChange={
                                        (e) => {
                                            synthEnvelope.attack = parseFloat(e.target.value);
                                            updateEnvelope("attack");
                                        }
                                    }
                                />
                            </div>
                        </div>
                        <div className={"effect2"}>
                            <label>Decay</label>
                            <div className={"sliderContainer"}>
                                <input
                                    type={"range"}
                                    id={"decay-slider"}
                                    min={"0.1"}
                                    max={"3"}
                                    defaultValue={synthEnvelope.decay}
                                    step={"0.01"}
                                    onChange={
                                        (e) => {
                                            synthEnvelope.decay = parseFloat(e.target.value);
                                            updateEnvelope("decay");
                                        }
                                    }
                                />
                            </div>
                        </div>
                        <div className={"effect2"}>
                            <label>Sustain</label>
                            <div className={"sliderContainer"}>
                                <input
                                    type={"range"}
                                    id={"sustain-slider"}
                                    min={"0"}
                                    max={"1"}
                                    defaultValue={synthEnvelope.sustain}
                                    step={"0.01"}
                                    onChange={
                                        (e) => {
                                            synthEnvelope.sustain = parseFloat(e.target.value);
                                            updateEnvelope("sustain");
                                        }
                                    }
                                />
                            </div>
                        </div>
                        <div className={"effect2"}>
                            <label>Release</label>
                            <div className={"sliderContainer"}>
                                <input
                                    type={"range"}
                                    id={"release-slider"}
                                    min={"0.01"}
                                    max={"5"}
                                    defaultValue={synthEnvelope.release}
                                    step={"0.01"}
                                    onChange={
                                        (e) => {
                                            synthEnvelope.release = parseFloat(e.target.value);
                                            updateEnvelope("release");
                                        }
                                    }
                                />
                            </div>
                        </div>
                    </div>
                    <input type="radio" id="modifier1" name="modifier" value="1" onClick={
                        () => {
                            synthType.oscillator_type = "";
                            // updateButton();
                            updateSynth();
                        }
                    }/>
                    <label htmlFor="modifier1" className="radio-label">NONE</label>

                    <input type="radio" id="modifier2" name="modifier" value="2" onClick={
                        () => {
                            synthType.oscillator_type = "am";
                            // updateButton();
                            updateSynth();
                        }
                    }/>
                    <label htmlFor="modifier2" className="radio-label">AM</label>

                    <input type="radio" id="modifier3" name="modifier" value="3" onClick={
                        () => {
                            synthType.oscillator_type = "fm";
                            // updateButton();
                            updateSynth();
                        }
                    }/>
                    <label htmlFor="modifier3" className="radio-label">FM</label>

                    <input type="radio" id="modifier4" name="modifier" value="4" onClick={
                        () => {
                            synthType.oscillator_type = "fat";
                            // updateButton();
                            updateSynth();
                        }
                    }/>
                    <label htmlFor="modifier4" className="radio-label">FAT</label>

                </div>
                <div className={"vertical"} id={"effects-column"}>
                    <div className={"column-title"}>
                        <h3>Modular Effects</h3>
                    </div>
                    <div className={"horizontal"}>
                        <div className={"vertical"} id={"left"}>
                            <div className={"vertical"}>
                                <div className={"effectVertical"}>
                                    <label>Highpass</label>
                                    <div className={"effectHorizontal"}>
                                        <input
                                            type={"checkbox"}
                                            id={"highpass-toggle"}
                                            onChange={
                                                (e) => {
                                                    if (e.target.checked) {
                                                        addModule("highpass");
                                                    } else {
                                                        removeModule("highpass");
                                                    }
                                                }
                                            }
                                        />
                                        <input
                                            type={"range"}
                                            id={"highpass-slider"}
                                            min={"20"}
                                            max={"5000"}
                                            defaultValue={effectValues.highpass}
                                            step={"1"}
                                            onChange={
                                                (e) => {
                                                    const value = parseFloat(e.target.value);
                                                    effectValues.highpass = value;
                                                    if (existingModules.some(module => module.id === "highpass")) {
                                                        const {instance} = existingModules.find(module => module.id === "highpass")!;
                                                        (instance as Tone.Filter).frequency.value = value;
                                                    }
                                                }
                                            }
                                        />
                                    </div>
                                </div>
                                <div className={"effectVertical"}>
                                    <label>Lowpass</label>
                                    <div className={"effectHorizontal"}>
                                        <input
                                            type={"checkbox"}
                                            id={"lowpass-toggle"}
                                            onChange = {
                                                (e) => {
                                                    if (e.target.checked) {
                                                        addModule("lowpass");
                                                    }
                                                    else {
                                                        removeModule("lowpass");
                                                    }
                                                }
                                            }
                                        />
                                        <input
                                            type={"range"}
                                            id={"lowpass-slider"}
                                            min={"20"}
                                            max={"5000"}
                                            defaultValue={effectValues.lowpass}
                                            step={"1"}
                                            onChange = {
                                                (e) => {
                                                    const value = parseFloat(e.target.value);
                                                    effectValues.lowpass = value;
                                                    if (existingModules.some(module => module.id === "lowpass")) {
                                                        const { instance } = existingModules.find(module => module.id === "lowpass")!;
                                                        (instance as Tone.Filter).frequency.value = value;
                                                    }
                                                }
                                            }
                                        />
                                    </div>
                                </div>
                                <div className={"effectVertical"}>
                                    <label>Bandpass</label>
                                    <div className={"effectHorizontal"}>
                                        <input
                                            type={"checkbox"}
                                            id={"bandpass-toggle"}
                                            onChange = {
                                                (e) => {
                                                    if (e.target.checked) {
                                                        addModule("bandpass");
                                                    }
                                                    else {
                                                        removeModule("bandpass");
                                                    }
                                                }
                                            }
                                        />
                                        <input
                                            type={"range"}
                                            id={"bandpass-slider"}
                                            min={"20"}
                                            max={"5000"}
                                            defaultValue={effectValues.bandpass}
                                            step={"1"}
                                            onChange = {
                                                (e) => {
                                                    const value = parseFloat(e.target.value);
                                                    effectValues.bandpass = value;
                                                    if (existingModules.some(module => module.id === "bandpass")) {
                                                        const { instance } = existingModules.find(module => module.id === "bandpass")!;
                                                        (instance as Tone.Filter).frequency.value = value;
                                                    }
                                                }
                                            }
                                        />
                                    </div>
                                </div>
                                <div className={"effectVertical"}>
                                    <label>Notch</label>
                                    <div className={"effectHorizontal"}>
                                        <input
                                            type={"checkbox"}
                                            id={"notch-toggle"}
                                            onChange = {
                                                (e) => {
                                                    if (e.target.checked) {
                                                        addModule("notch");
                                                    }
                                                    else {
                                                        removeModule("notch");
                                                    }
                                                }
                                            }
                                        />
                                        <input
                                            type={"range"}
                                            id={"notch-slider"}
                                            min={"20"}
                                            max={"5000"}
                                            defaultValue={effectValues.notch}
                                            step={"1"}
                                            onChange = {
                                                (e) => {
                                                    const value = parseFloat(e.target.value);
                                                    effectValues.notch = value;
                                                    if (existingModules.some(module => module.id === "notch")) {
                                                        const { instance } = existingModules.find(module => module.id === "notch")!;
                                                        (instance as Tone.Filter).frequency.value = value;
                                                    }
                                                }
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className={"separator"}></div>
                            <div className={"vertical"}>
                                <div className={"effectVertical"}>
                                    <label>Delay</label>
                                    <div className={"effectHorizontal"}>
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
                                        <input
                                            type={"range"}
                                            id={"delay-slider"}
                                            min={"0"}
                                            max={"1"}
                                            defaultValue={effectValues.delay}
                                            step={"0.01"}
                                            onMouseUp={() => {
                                                    if (existingModules.some(module => module.id === "delay")) {
                                                        const { instance } = existingModules.find(module => module.id === "delay")!;
                                                        (instance as Tone.Delay).delayTime.value = effectValues.delay;
                                                    }
                                                }
                                            }
                                            onChange = {
                                                (e) => {
                                                    effectValues.delay = parseFloat(e.target.value);
                                                }
                                            }
                                        />
                                    </div>
                                </div>
                                <div className={"effectVertical"}>
                                    <label>Reverb</label>
                                    <div className={"effectHorizontal"}>
                                        <input
                                            type={"checkbox"}
                                            id={"reverb-toggle"}
                                            onChange = {
                                                (e) => {
                                                    if (e.target.checked) {
                                                        addModule("reverb");
                                                    }
                                                    else {
                                                        removeModule("reverb");
                                                    }
                                                }
                                            }
                                        />
                                        <input
                                            type={"range"}
                                            id={"reverb-slider"}
                                            min={"0.01"}
                                            max={"5"}
                                            defaultValue={effectValues.reverb}
                                            step={"0.01"}
                                            onMouseUp={() => {
                                                if (existingModules.some(module => module.id === "reverb")) {
                                                    const { instance } = existingModules.find(module => module.id === "reverb")!;
                                                    (instance as Tone.Reverb).decay = effectValues.reverb;
                                                }
                                                }
                                            }
                                            onChange = {
                                                (e) => {
                                                    effectValues.reverb = parseFloat(e.target.value);
                                                }
                                            }
                                        />
                                    </div>
                                </div>
                                <div className={"effectVertical"}>
                                    <label>Feedback</label>
                                    <div className={"effectHorizontal"}>
                                        <input
                                            type={"checkbox"}
                                            id={"feedback-toggle"}
                                            onChange = {
                                                (e) => {
                                                    if (e.target.checked) {
                                                        addModule("feedback");
                                                    }
                                                    else {
                                                        removeModule("feedback");
                                                    }
                                                }
                                            }
                                        />
                                        <div className={"vertical"}>
                                            <input
                                                type={"range"}
                                                id={"feedback-slider-1"}
                                                min={"0"}
                                                max={"2"}
                                                defaultValue={effectValues.feedback1}
                                                step={"0.01"}
                                                onMouseUp={
                                                    () => {
                                                        if (existingModules.some(module => module.id === "feedback")) {
                                                            const { instance } = existingModules.find(module => module.id === "feedback")!;
                                                            (instance as Tone.FeedbackDelay).delayTime.value = effectValues.feedback1;
                                                        }
                                                    }
                                                }
                                                onChange = {
                                                    (e) => {
                                                        effectValues.feedback1 = parseFloat(e.target.value);
                                                    }
                                                }
                                            />
                                            <input
                                                type={"range"}
                                                id={"feedback-slider-2"}
                                                min={"0"}
                                                max={"1"}
                                                defaultValue={effectValues.feedback2}
                                                step={"0.01"}
                                                onChange = {
                                                    (e) => {
                                                        const value = parseFloat(e.target.value);
                                                        effectValues.feedback2 = value;
                                                        if (existingModules.some(module => module.id === "feedback")) {
                                                            const { instance } = existingModules.find(module => module.id === "feedback")!;
                                                            (instance as Tone.FeedbackDelay).feedback.value = value;
                                                        }
                                                    }
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className={"effectVertical"}>
                                    <label>PingPong</label>
                                    <div className={"effectHorizontal"}>
                                        <input
                                            type={"checkbox"}
                                            id={"pingpong-toggle"}
                                            onChange = {
                                                (e) => {
                                                    if (e.target.checked) {
                                                        addModule("pingpong");
                                                    }
                                                    else {
                                                        removeModule("pingpong");
                                                    }
                                                }
                                            }
                                        />
                                        <div className={"vertical"}>
                                            <input
                                                type={"range"}
                                                id={"pingpong-slider-1"}
                                                min={"0"}
                                                max={"2"}
                                                defaultValue={effectValues.pingpong1}
                                                step={"0.01"}
                                                onMouseUp={
                                                    () => {
                                                        if (existingModules.some(module => module.id === "pingpong")) {
                                                            const { instance } = existingModules.find(module => module.id === "pingpong")!;
                                                            (instance as Tone.PingPongDelay).delayTime.value = effectValues.pingpong1;
                                                        }
                                                    }
                                                }
                                                onChange = {
                                                    (e) => {
                                                        effectValues.pingpong1 = parseFloat(e.target.value);
                                                    }
                                                }
                                            />
                                            <input
                                                type={"range"}
                                                id={"pingpong-slider-2"}
                                                min={"0"}
                                                max={"1"}
                                                defaultValue={effectValues.pingpong2}
                                                step={"0.01"}
                                                onChange = {
                                                    (e) => {
                                                        const value = parseFloat(e.target.value);
                                                        effectValues.pingpong2 = value;
                                                        if (existingModules.some(module => module.id === "pingpong")) {
                                                            const { instance } = existingModules.find(module => module.id === "pingpong")!;
                                                            (instance as Tone.PingPongDelay).feedback.value = value;
                                                        }
                                                    }
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={"vertical"} id={"right"}>
                            <div className={"effectVertical"}>
                                <label>Chorus</label>
                                <div className={"effectHorizontal"}>
                                    <input
                                        type={"checkbox"}
                                        id={"chorus-toggle"}
                                        onChange = {
                                            (e) => {
                                                if (e.target.checked) {
                                                    addModule("chorus");
                                                }
                                                else {
                                                    removeModule("chorus");
                                                }
                                            }
                                        }
                                    />
                                    <div className={"vertical"}>
                                        <input
                                            type={"range"}
                                            id={"chorus-slider-1"}
                                            min={"0"}
                                            max={"100"}
                                            defaultValue={effectValues.chorus1}
                                            step={"1"}
                                            onMouseUp={
                                                () => {
                                                    if (existingModules.some(module => module.id === "chorus")) {
                                                        const { instance } = existingModules.find(module => module.id === "chorus")!;
                                                        (instance as Tone.Chorus).delayTime = effectValues.chorus1;
                                                    }
                                                }
                                            }
                                            onChange = {
                                                (e) => {
                                                    effectValues.chorus1 = parseFloat(e.target.value);
                                                }
                                            }
                                        />
                                        <input
                                            type={"range"}
                                            id={"chorus-slider-2"}
                                            min={"0"}
                                            max={"5"}
                                            defaultValue={effectValues.chorus2}
                                            step={"0.1"}
                                            onMouseUp={
                                                () => {
                                                    if (existingModules.some(module => module.id === "chorus")) {
                                                        const { instance } = existingModules.find(module => module.id === "chorus")!;
                                                        (instance as Tone.Chorus).depth = effectValues.chorus2;
                                                    }
                                                }
                                            }
                                            onChange = {
                                                (e) => {
                                                    effectValues.chorus2 = parseFloat(e.target.value);

                                                }
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className={"effectVertical"}>
                                <label>Distortion</label>
                                <div className={"effectHorizontal"}>
                                    <input
                                        type={"checkbox"}
                                        id={"distortion-toggle"}
                                        onChange = {
                                            (e) => {
                                                if (e.target.checked) {
                                                    addModule("distortion");
                                                }
                                                else {
                                                    removeModule("distortion");
                                                }
                                            }
                                        }
                                    />
                                    <input
                                        type={"range"}
                                        id={"distortion-slider"}
                                        min={"0"}
                                        max={"1"}
                                        defaultValue={effectValues.distortion}
                                        step={"0.01"}
                                        onChange = {
                                            (e) => {
                                                const value = parseFloat(e.target.value);
                                                effectValues.distortion = value;
                                                if (existingModules.some(module => module.id === "distortion")) {
                                                    const { instance } = existingModules.find(module => module.id === "distortion")!;
                                                    (instance as Tone.Distortion).distortion = value;
                                                }
                                            }
                                        }
                                    />
                                </div>
                            </div>
                            <div className={"effectVertical"}>
                                <label>Wah</label>
                                <div className={"effectHorizontal"}>
                                    <input
                                        type={"checkbox"}
                                        id={"wah-toggle"}
                                        onChange = {
                                            (e) => {
                                                if (e.target.checked) {
                                                    addModule("wah");
                                                }
                                                else {
                                                    removeModule("wah");
                                                }
                                            }
                                        }
                                    />
                                    <input
                                        type={"range"}
                                        id={"wah-slider"}
                                        min={"0"}
                                        max={"10"}
                                        defaultValue={effectValues.wah}
                                        step={"0.1"}
                                        onChange = {
                                            (e) => {
                                                const value = parseFloat(e.target.value);
                                                effectValues.wah = value;
                                                if (existingModules.some(module => module.id === "wah")) {
                                                    const { instance } = existingModules.find(module => module.id === "wah")!;
                                                    (instance as Tone.AutoWah).octaves = value;
                                                }
                                            }
                                        }
                                    />
                                </div>
                            </div>
                            <div className={"effectVertical"}>
                                <label>Phaser</label>
                                <div className={"effectHorizontal"}>
                                    <input
                                        type={"checkbox"}
                                        id={"phaser-toggle"}
                                        onChange = {
                                            (e) => {
                                                if (e.target.checked) {
                                                    addModule("phaser");
                                                }
                                                else {
                                                    removeModule("phaser");
                                                }
                                            }
                                        }
                                    />
                                    <div className={"vertical"}>
                                        <input
                                            type={"range"}
                                            id={"phaser-slider-1"}
                                            min={"0"}
                                            max={"3"}
                                            defaultValue={effectValues.phaser1}
                                            step={"0.01"}
                                            onChange = {
                                                (e) => {
                                                    const value = parseFloat(e.target.value);
                                                    effectValues.phaser1 = value;
                                                    if (existingModules.some(module => module.id === "phaser")) {
                                                        const { instance } = existingModules.find(module => module.id === "phaser")!;
                                                        (instance as Tone.Phaser).frequency.value = value;
                                                    }
                                                }
                                            }
                                        />
                                        <input
                                            type={"range"}
                                            id={"phaser-slider-2"}
                                            min={"0"}
                                            max={"10"}
                                            defaultValue={effectValues.phaser2}
                                            step={"0.1"}
                                            onChange = {
                                                (e) => {
                                                    const value = parseFloat(e.target.value);
                                                    effectValues.phaser2 = value;
                                                    if (existingModules.some(module => module.id === "phaser")) {
                                                        const { instance } = existingModules.find(module => module.id === "phaser")!;
                                                        (instance as Tone.Phaser).octaves = value;
                                                    }
                                                }
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className={"effectVertical"}>
                                <label>Widener</label>
                                <div className={"effectHorizontal"}>
                                    <input
                                        type={"checkbox"}
                                        id={"widener-toggle"}
                                        onChange = {
                                            (e) => {
                                                if (e.target.checked) {
                                                    addModule("widener");
                                                }
                                                else {
                                                    removeModule("widener");
                                                }
                                            }
                                        }
                                    />
                                    <input
                                        type={"range"}
                                        id={"widener-slider"}
                                        min={"0"}
                                        max={"1"}
                                        defaultValue={effectValues.widener}
                                        step={"0.01"}
                                        onChange = {
                                            (e) => {
                                                const value = parseFloat(e.target.value);
                                                effectValues.widener = value;
                                                if (existingModules.some(module => module.id === "widener")) {
                                                    const { instance } = existingModules.find(module => module.id === "widener")!;
                                                    (instance as Tone.StereoWidener).width.value = value;
                                                }
                                            }
                                        }
                                    />
                                </div>
                            </div>
                            <div className={"effectVertical"}>
                                <label>Vibrato</label>
                                <div className={"effectHorizontal"}>
                                    <input
                                        type={"checkbox"}
                                        id={"vibrato-toggle"}
                                        onChange = {
                                            (e) => {
                                                if (e.target.checked) {
                                                    addModule("vibrato");
                                                }
                                                else {
                                                    removeModule("vibrato");
                                                }
                                            }
                                        }
                                    />
                                    <div className={"vertical"}>
                                        <input
                                            type={"range"}
                                            id={"vibrato-slider-1"}
                                            min={"1"}
                                            max={"20"}
                                            defaultValue={effectValues.vibrato1}
                                            step={"0.01"}
                                            onChange = {
                                                (e) => {
                                                    const value = parseFloat(e.target.value);
                                                    effectValues.vibrato1 = value;
                                                    if (existingModules.some(module => module.id === "vibrato")) {
                                                        const { instance } = existingModules.find(module => module.id === "vibrato")!;
                                                        (instance as Tone.Vibrato).frequency.value = value;
                                                    }
                                                }
                                            }
                                        />
                                        <input
                                            type={"range"}
                                            id={"vibrato-slider-2"}
                                            min={"0"}
                                            max={"1"}
                                            defaultValue={effectValues.vibrato2}
                                            step={"0.01"}
                                            onChange = {
                                                (e) => {
                                                    const value = parseFloat(e.target.value);
                                                    effectValues.vibrato2 = value;
                                                    if (existingModules.some(module => module.id === "vibrato")) {
                                                        const { instance } = existingModules.find(module => module.id === "vibrato")!;
                                                        (instance as Tone.Vibrato).depth.value = value;
                                                    }
                                                }
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className={"effectVertical"}>
                                <label>Bit Crusher</label>
                                <div className={"effectHorizontal"}>
                                    <input
                                        type={"checkbox"}
                                        id={"bitcrusher-toggle"}
                                        onChange = {
                                            (e) => {
                                                if (e.target.checked) {
                                                    addModule("bitcrusher");
                                                }
                                                else {
                                                    removeModule("bitcrusher");
                                                }
                                            }
                                        }
                                    />
                                    <input
                                        type={"range"}
                                        id={"bitcrusher-slider"}
                                        min={"3"}
                                        max={"8"}
                                        defaultValue={effectValues.bitcrusher}
                                        step={"1"}
                                        onChange = {
                                            (e) => {
                                                const value = parseFloat(e.target.value);
                                                effectValues.bitcrusher = value;
                                                if (existingModules.some(module => module.id === "bitcrusher")) {
                                                    const { instance } = existingModules.find(module => module.id === "bitcrusher")!;
                                                    (instance as Tone.BitCrusher).bits.value = value;
                                                }
                                            }
                                        }
                                    />
                                </div>
                            </div>
                            <div className={"effectVertical"}>
                                <label>Chebyshev</label>
                                <div className={"effectHorizontal"}>
                                    <input
                                        type={"checkbox"}
                                        id={"chebyshev-toggle"}
                                        onChange = {
                                            (e) => {
                                                if (e.target.checked) {
                                                    addModule("chebyshev");
                                                }
                                                else {
                                                    removeModule("chebyshev");
                                                }
                                            }
                                        }
                                    />
                                    <input
                                        type={"range"}
                                        id={"chebyshev-slider"}
                                        min={"1"}
                                        max={"100"}
                                        defaultValue={effectValues.chebyshev}
                                        step={"1"}
                                        onChange = {
                                            (e) => {
                                                const value = parseFloat(e.target.value);
                                                effectValues.chebyshev = value;
                                                if (existingModules.some(module => module.id === "chebyshev")) {
                                                    const { instance } = existingModules.find(module => module.id === "chebyshev")!;
                                                    (instance as Tone.Chebyshev).order = value;
                                                }
                                            }
                                        }
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
