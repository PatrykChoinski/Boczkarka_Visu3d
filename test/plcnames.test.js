import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasPlcName, plcNameRanges, stripPlcNames } from '../src/shared/plcnames.js';

test('opisy zmiennych PLC (tylko Admin): nazwy w nawiasach i dopiskach rozpoznane, zwykle opisy zostaja', () => {
  assert.equal(stripPlcNames('Początek X (fManualXZeroPosition)'), 'Początek X');
  assert.equal(stripPlcNames('Dwa punkty (inaczej kąt i długość) – bManualTwoPoint'), 'Dwa punkty (inaczej kąt i długość)');
  assert.equal(stripPlcNames('Wysokość polerki [mm] (ActiveTool.Height)'), 'Wysokość polerki [mm]');
  assert.equal(stripPlcNames('Zapisz start – pozycja osi (jak w PLC: bProgramSaveStartPosition, frez: bProgramMillStartPointSave)'), 'Zapisz start – pozycja osi');
  // podpowiedz Serwisu: linia "HMI: ..." i opis dzialania w PLC (z nazwami) - znikaja
  assert.equal(stripPlcNames('HMI: HMI.fServiceXLimitNegative\nWorkArea -> axisX.fSWLimitNegative'), '');
  // bez nazw zmiennych - bez zmian
  for (const t of ['Głębokość cięcia (grubość) [mm]', 'G-kod (CNC)', 'Przesuw roboczy – piła', 'Obrót A [°]', 'Stół i kamień']) {
    assert.equal(stripPlcNames(t), t);
    assert.equal(plcNameRanges(t).length, 0);
  }
  assert.ok(hasPlcName('aCuttingBoardX/Y/Z') && hasPlcName('HMI.bService…') && hasPlcName('yLaser'));
  assert.ok(!hasPlcName('Zapisane_Pozycje w HMI') && !hasPlcName('OPC UA – węzeł, typ, wartość'));
});
