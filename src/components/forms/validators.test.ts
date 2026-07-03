import { describe, it, expect } from 'vitest';
import {
  requiredValidator,
  requiredTrimmedValidator,
  minLengthValidator,
  maxLengthValidator,
  emailValidator,
  passwordPolicyValidator,
  composeValidators,
} from './validators';

describe('requiredValidator', () => {
  it('returns "Required" for empty values', () => {
    expect(requiredValidator(undefined)).to.equal('Required');
    expect(requiredValidator('')).to.equal('Required');
  });
  it('passes non-empty values', () => {
    expect(requiredValidator('x')).to.equal(undefined);
  });
});

describe('requiredTrimmedValidator', () => {
  it('fails whitespace-only values', () => {
    expect(requiredTrimmedValidator('   ')).to.equal('Required');
  });
  it('passes values with content', () => {
    expect(requiredTrimmedValidator(' x ')).to.equal(undefined);
  });
});

describe('minLengthValidator / maxLengthValidator', () => {
  it('enforces the exact bounds', () => {
    expect(minLengthValidator(3)('ab')).to.equal('Min length is 3');
    expect(minLengthValidator(3)('abc')).to.equal(undefined);
    expect(maxLengthValidator(3)('abcd')).to.equal('Max length is 3');
    expect(maxLengthValidator(3)('abc')).to.equal(undefined);
  });
  it('skips empty values (pair with requiredValidator)', () => {
    expect(minLengthValidator(3)('')).to.equal(undefined);
    expect(minLengthValidator(3)(undefined)).to.equal(undefined);
  });
});

describe('emailValidator', () => {
  it('rejects an obviously bad address with the exact message', () => {
    expect(emailValidator('not-an-email')).to.equal(
      'Enter a valid email address.',
    );
  });
  it('passes a normal address and empty values', () => {
    expect(emailValidator('a@b.co')).to.equal(undefined);
    expect(emailValidator('')).to.equal(undefined);
    expect(emailValidator(undefined)).to.equal(undefined);
  });
});

describe('passwordPolicyValidator', () => {
  const policy = {
    minLength: 8,
    minNumbers: 1,
    minUpper: 1,
    minSpecial: 1,
  };
  const validate = passwordPolicyValidator(policy);

  it('reports the first unmet rule with its exact message', () => {
    expect(validate('short')).to.equal('Minimum 8 characters');
    expect(validate('longenough')).to.equal('At least 1 number(s)');
    expect(validate('longenough1')).to.equal(
      'At least 1 uppercase letter(s)',
    );
    expect(validate('Longenough1')).to.equal(
      'At least 1 special character(s)',
    );
  });
  it('passes a compliant password and empty values', () => {
    expect(validate('Longenough1!')).to.equal(undefined);
    expect(validate('')).to.equal(undefined);
  });
  it('respects allowedSpecial when counting special characters', () => {
    const strict = passwordPolicyValidator({
      minLength: 1,
      minSpecial: 1,
      allowedSpecial: '!',
    });
    expect(strict('abc?')).to.equal('At least 1 special character(s)');
    expect(strict('abc!')).to.equal(undefined);
  });
});

describe('composeValidators', () => {
  it('returns the first error, left to right', () => {
    const validate = composeValidators(requiredValidator, emailValidator);
    expect(validate('')).to.equal('Required');
    expect(validate('bad')).to.equal('Enter a valid email address.');
    expect(validate('a@b.co')).to.equal(undefined);
  });
});
