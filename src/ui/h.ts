import htm from 'htm';
import { h, render, Fragment } from 'preact';
import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'preact/hooks';

export { h, render, Fragment, useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect };
export const html = htm.bind(h);
