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

  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
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
  }, []);

  return (
    <main>
      <Head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
            .CodeMirror {
              height: auto !important;
              margin: 1em 0;
            }

            .CodeMirror-scroll {
              height: auto !important;
              overflow: visible !important;
            }
          `,
          }}
        />
        <title>{`${props.name} - WebGPU Samples`}</title>
        <meta name="description" content={props.description} />
        <meta httpEquiv="origin-trial" content={props.originTrial} />
      </Head>
      <div>
        <h1>{props.name}</h1>
        <a
          target="_blank"
          rel="noreferrer"
          href={`https://github.com/${process.env.REPOSITORY_NAME}/tree/main/${props.filename}`}
        >
          See it on Github!
        </a>
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
