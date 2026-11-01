import React from 'react';
import { BodyRelease, type BodyReleaseProps } from './BodyRelease';

export function BodyReleaseWard(props: Omit<BodyReleaseProps, 'screenId'>) {
  return <BodyRelease {...props} screenId="body_release_ward" />;
}
