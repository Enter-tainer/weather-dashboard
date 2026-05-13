export function getBeaufort(speedKmh) {
  if (speedKmh < 2) return 0;
  if (speedKmh < 6) return 1;
  if (speedKmh < 12) return 2;
  if (speedKmh < 20) return 3;
  if (speedKmh < 29) return 4;
  if (speedKmh < 39) return 5;
  if (speedKmh < 50) return 6;
  if (speedKmh < 62) return 7;
  if (speedKmh < 75) return 8;
  if (speedKmh < 89) return 9;
  if (speedKmh < 103) return 10;
  if (speedKmh < 118) return 11;
  return 12;
}

export function calculateDashboardScales(data) {
  let minTemp = Infinity;
  let maxTemp = -Infinity;
  let minP = Infinity;
  let maxP = -Infinity;
  let maxBft = 0;

  if (data && data.length > 0) {
    data.forEach(d => {
      if (d.temperature < minTemp) minTemp = d.temperature;
      if (d.temperature > maxTemp) maxTemp = d.temperature;
      d.tempMembers?.forEach(m => {
        if (m < minTemp) minTemp = m;
        if (m > maxTemp) maxTemp = m;
      });

      if (d.pressure < minP) minP = d.pressure;
      if (d.pressure > maxP) maxP = d.pressure;
      d.pressureMembers?.forEach(m => {
        if (m < minP) minP = m;
        if (m > maxP) maxP = m;
      });

      const bSpeed = getBeaufort(d.windSpeed);
      const bGusts = getBeaufort(d.windGusts);
      if (bSpeed > maxBft) maxBft = bSpeed;
      if (bGusts > maxBft) maxBft = bGusts;
    });
  }

  if (minTemp !== Infinity) {
    minTemp -= 5;
    maxTemp += 5;
    if (minTemp === maxTemp) maxTemp += 1;
  }

  if (minP !== Infinity) {
    minP = Math.floor(minP) - 1;
    maxP = Math.ceil(maxP) + 1;
    if (minP === maxP) maxP += 1;
  }

  if (maxBft < 4) maxBft = 4;

  const tempSteps = [];
  if (minTemp !== Infinity) {
    const minTempVal = Math.floor(minTemp / 5) * 5;
    const maxTempVal = Math.ceil(maxTemp / 5) * 5;
    for (let t = minTempVal; t <= maxTempVal; t += 5) tempSteps.push(t);
  }

  return { minTemp, maxTemp, minP, maxP, maxBft, tempSteps };
}
