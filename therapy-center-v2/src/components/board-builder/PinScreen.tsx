import { useState, useRef, useEffect } from 'react';

const MASTER_PIN = '6724';

interface PinScreenProps {
  kidPin: string;
  onSuccess: () => void;
}

export default function PinScreen({ kidPin, onSuccess }: PinScreenProps) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError(false);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check PIN when all digits entered
    if (newDigits.every((d) => d) && (value || index === 3)) {
      const pin = newDigits.join('');
      const validPin = kidPin || '1234';
      if (pin === validPin || pin === MASTER_PIN) {
        onSuccess();
      } else {
        setError(true);
        setTimeout(() => {
          setDigits(['', '', '', '']);
          inputRefs.current[0]?.focus();
        }, 600);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="bb-pin-screen">
      <div className="bb-pin-card">
        <div className="bb-pin-icon">🔒</div>
        <h2>הכנס קוד PIN</h2>
        <p>הכנס את הקוד כדי לערוך את הלוח</p>

        <div className={`bb-pin-inputs ${error ? 'bb-pin-shake' : ''}`}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              className={`bb-pin-digit ${error ? 'bb-pin-error' : ''}`}
              value={digit}
              onChange={(e) => handleInput(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>

        {error && <div className="bb-pin-error-msg">קוד שגוי, נסה שוב</div>}
      </div>
    </div>
  );
}
