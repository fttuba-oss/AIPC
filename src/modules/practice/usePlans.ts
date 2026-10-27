import { useCallback, useEffect, useState } from 'react';
import type { PracticeGateway, PracticePlan } from '../../contracts';
export function usePlans(gateway: PracticeGateway, filter: { studentId?: string; teacherId?: string }) {
  const [plans, setPlans] = useState<PracticePlan[]>([]);
  const [error, setError] = useState('');
  const studentId = filter.studentId, teacherId = filter.teacherId;
  const refresh = useCallback(async () => {
    try { const data = await gateway.plans({ studentId, teacherId }); setPlans(data); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [gateway, studentId, teacherId]);
  useEffect(() => {
    let active = true, running = false;
    setPlans([]); setError('');
    const poll = async () => {
      if (running) return;
      running = true;
      try { const data = await gateway.plans({ studentId, teacherId }); if (active) { setPlans(data); setError(''); } }
      catch (e) { if (active) setError(e instanceof Error ? e.message : String(e)); }
      finally { running = false; }
    };
    void poll(); const timer = window.setInterval(() => void poll(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [gateway, studentId, teacherId]);
  return { plans, error, refresh };
}
