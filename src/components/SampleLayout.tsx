import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { GUI } from 'dat.gui';
import type { Stats } from 'stats-js';
import type { Editor, EditorConfiguration } from 'codemirror';
interface CodeMirrorEditor extends Editor {
  updatedSource: (source: string) => void;
}

import styles from './SampleLayout.module.css';

export type SampleInit = (params: {
  canvas: HTMLCanvasElement;
  pageState: { active: boolean };
  gui?: GUI;
  stats?: Stats;
  videoURL?: string;
}) => void | Promise<void>;

const SampleLayout: React.FunctionComponent<
  React.PropsWithChildren<{
    name: string;
    description: string;
    originTrial?: string;
    filename: string;
    gui?: boolean;
    stats?: boolean;
    init: SampleInit;
  }>
> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const guiParentRef = useRef<HTMLDivElement | null>(null);
  const gui: GUI | undefined = useMemo(() => {
    if (props.gui && process.browser) {
      const dat = require('dat.gui');
      return new dat.GUI({ autoPlace: false });
    }
    return undefined;
  }, []);

  const statsParentRef = useRef<HTMLDivElement | null>(null);
  const stats: Stats | undefined = useMemo(() => {
    if (props.stats && process.browser) {
      const Stats = require('stats-js');
      return new Stats();
    }
    return undefined;
  }, []);

  const [videoURL, setVideoURL] = useState('../assets/video/OnePunchMan.mp4');
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const localURL = URL.createObjectURL(file);
      setVideoURL(localURL);
    }
  };

  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    if (gui && guiParentRef.current) {
      guiParentRef.current.appendChild(gui.domElement);

      // HACK: useEffect() is sometimes called twice, resulting in the GUI being populated twice.
      // Erase any existing controllers before calling init() on the sample.
      while (gui.__controllers.length > 0) {
        gui.__controllers[0].remove();
      }
    }

    const pageState = {
      active: true,
    };
    const cleanup = () => {
      pageState.active = false;
    };
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('The canvas is not available');
      }
      const p = props.init({
        canvas,
        pageState,
        gui,
        stats,
        videoURL,
      });

      if (p instanceof Promise) {
        p.catch((err: Error) => {
          console.error(err);
          setError(err);
        });
      }
    } catch (err) {
      console.error(err);
      setError(err);
    }
    return cleanup;
  }, [videoURL]);

  return (
    <main>
      <div>
        <h1>{props.name}</h1>
        <p>{props.description}</p>
        {error ? (
          <>
            <p>
              Something went wrong. Do your browser and device support WebGPU?
            </p>
            <p>{`${error}`}</p>
          </>
        ) : null}
      </div>
      <div className={styles.canvasContainer}>
        <div
          style={{
            position: 'absolute',
            left: 10,
          }}
          ref={statsParentRef}
        ></div>
        <div
          style={{
            position: 'absolute',
            right: 10,
          }}
          ref={guiParentRef}
        ></div>
        <canvas ref={canvasRef}></canvas>
      </div>
      <input type="file" accept="video/*" onChange={handleFileChange} />
    </main>
  );
};

export default SampleLayout;

export const makeSample: (
  ...props: Parameters<typeof SampleLayout>
) => JSX.Element = (props) => {
  return <SampleLayout {...props} />;
};

export function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}
