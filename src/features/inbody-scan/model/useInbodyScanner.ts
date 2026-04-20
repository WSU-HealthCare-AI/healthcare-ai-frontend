import { useState, useRef, useEffect, useCallback } from 'react';
import { startScanSession } from '../api/scanApi';
import type { InbodyRecord, SegmentalLean } from '@/src/entities/inbody/model/types';

export type ScanStatus = 'idle' | 'connecting' | 'scanning' | 'complete' | 'error';

type ConfidenceMap = Record<string, number>;

const REQUIRED_MAIN_FIELDS: Array<keyof InbodyRecord> = [
  'total_body_water_L',
  'protein_kg',
  'minerals_kg',
  'body_fat_mass_kg',
  'weight_kg',
  'skeletal_muscle_mass_kg',
  'bmi',
  'body_fat_percentage',
];

const REQUIRED_SEGMENTAL_FIELDS: Array<keyof SegmentalLean> = [
  'right_arm',
  'left_arm',
  'trunk',
  'right_leg',
  'left_leg',
];

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}

function isCompleteRecord(data: Partial<InbodyRecord> | null): data is InbodyRecord {
  if (!data) return false;

  const mainOk = REQUIRED_MAIN_FIELDS.every((key) => hasValue(data[key]));
  if (!mainOk) return false;

  if (!data.segmental_lean) return false;

  const segmentalOk = REQUIRED_SEGMENTAL_FIELDS.every((key) =>
    hasValue(data.segmental_lean?.[key])
  );

  return segmentalOk;
}

function countCompletedFields(data: Partial<InbodyRecord> | null) {
  if (!data) return 0;

  let count = 0;

  for (const key of REQUIRED_MAIN_FIELDS) {
    if (hasValue(data[key])) count += 1;
  }

  if (data.segmental_lean) {
    for (const key of REQUIRED_SEGMENTAL_FIELDS) {
      if (hasValue(data.segmental_lean[key])) count += 1;
    }
  }

  return count;
}

export function useInbodyScanner() {
  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<ScanStatus>('idle');
  const partialRef = useRef<Partial<InbodyRecord> | null>(null);
  const completedRef = useRef(false);

  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [framesSent, setFramesSent] = useState(0);
  const [fieldsFound, setFieldsFound] = useState(0);
  const [partialResult, setPartialResult] = useState<Partial<InbodyRecord> | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceMap>({});
  const [finalResult, setFinalResult] = useState<InbodyRecord | null>(null);

  const startSession = useCallback(async () => {
    try {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      partialRef.current = null;
      completedRef.current = false;

      setStatus('connecting');
      statusRef.current = 'connecting';
      setFramesSent(0);
      setFieldsFound(0);
      setPartialResult(null);
      setConfidence({});
      setFinalResult(null);

      const { wsUrl: url } = await startScanSession();
      setWsUrl(url);
    } catch (err) {
      console.error('[Session] Error:', err);
      setStatus('error');
      statusRef.current = 'error';
    }
  }, []);

  useEffect(() => {
    if (!wsUrl) return;

    const socket = new WebSocket(wsUrl);
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      setStatus('scanning');
      statusRef.current = 'scanning';
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);

        if (msg.type === 'ack') return;

        if (msg.type === 'partial') {
          const merged: Partial<InbodyRecord> = {
            ...(partialRef.current ?? {}),
            ...(msg.data ?? {}),
            segmental_lean:
              partialRef.current?.segmental_lean || msg.data?.segmental_lean
                ? {
                    ...(partialRef.current?.segmental_lean ?? {}),
                    ...(msg.data?.segmental_lean ?? {}),
                  }
                : null,
          };

          partialRef.current = merged;
          setPartialResult(merged);

          if (msg.confidence && typeof msg.confidence === 'object') {
            setConfidence((prev) => ({
              ...prev,
              ...msg.confidence,
            }));
          }

          setFieldsFound(countCompletedFields(merged));

          if (!completedRef.current && isCompleteRecord(merged)) {
            completedRef.current = true;
            setFinalResult(merged);
            setStatus('complete');
            statusRef.current = 'complete';
          }

          return;
        }

        if (msg.type === 'final') {
          const finalData = msg.data as InbodyRecord;

          partialRef.current = finalData;
          completedRef.current = true;

          setPartialResult(finalData);
          setFinalResult(finalData);

          if (msg.confidence && typeof msg.confidence === 'object') {
            setConfidence((prev) => ({
              ...prev,
              ...msg.confidence,
            }));
          }

          setFieldsFound(countCompletedFields(finalData));
          setStatus('complete');
          statusRef.current = 'complete';
          return;
        }

        if (msg.type === 'error') {
          console.warn('[SCAN][SERVER_ERROR]', msg.message);
          setStatus('error');
          statusRef.current = 'error';
        }
      } catch (e) {
        console.warn('[SCAN][PARSE_ERROR]', e);
      }
    };

    socket.onerror = (e) => {
      console.warn('[SCAN][WS_ERROR]', e);
      if (!completedRef.current) {
        setStatus('error');
        statusRef.current = 'error';
      }
    };

    socket.onclose = () => {
      if (!completedRef.current && statusRef.current === 'scanning') {
        setStatus('error');
        statusRef.current = 'error';
      }
    };

    wsRef.current = socket;

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [wsUrl]);

  const sendFrame = useCallback((jpegBuffer: ArrayBuffer) => {
    const ws = wsRef.current;
    if (
      ws &&
      ws.readyState === WebSocket.OPEN &&
      statusRef.current === 'scanning' &&
      !completedRef.current
    ) {
      try {
        ws.send(jpegBuffer);
        setFramesSent((prev) => prev + 1);
      } catch (err) {
        console.warn('[SCAN][SEND_ERROR]', err);
      }
    }
  }, []);

  return {
    status,
    framesSent,
    fieldsFound,
    partialResult,
    confidence,
    finalResult,
    startSession,
    sendFrame,
  };
}
