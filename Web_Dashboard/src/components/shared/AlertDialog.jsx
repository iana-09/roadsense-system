/**
 * components/shared/AlertDialog.jsx
 * Radix-based AlertDialog — used by all three dashboards.
 */

import React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';

export const AlertDialog        = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal  = AlertDialogPrimitive.Portal;

export const AlertDialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={`fixed inset-0 z-[4999] bg-black/80 ${className || ''}`}
    {...props} ref={ref}
  />
));
AlertDialogOverlay.displayName = 'AlertDialogOverlay';

export const AlertDialogContent = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={`fixed left-[50%] top-[50%] z-[5000] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-slate-700 bg-slate-800 p-6 shadow-lg rounded-lg ${className || ''}`}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = 'AlertDialogContent';

export const AlertDialogHeader = ({ className, ...props }) => (
  <div className={`flex flex-col space-y-2 text-center sm:text-left ${className || ''}`} {...props} />
);

export const AlertDialogFooter = ({ className, ...props }) => (
  <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className || ''}`} {...props} />
);

export const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={`text-lg font-semibold text-white ${className || ''}`}
    {...props}
  />
));
AlertDialogTitle.displayName = 'AlertDialogTitle';

export const AlertDialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={`text-sm text-gray-400 ${className || ''}`}
    {...props}
  />
));
AlertDialogDescription.displayName = 'AlertDialogDescription';

export const AlertDialogAction = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-teal-600 text-white hover:bg-teal-700 h-10 px-4 py-2 ${className || ''}`}
    {...props}
  />
));
AlertDialogAction.displayName = 'AlertDialogAction';

export const AlertDialogCancel = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-slate-600 bg-slate-700 text-white hover:bg-slate-600 h-10 px-4 py-2 mt-2 sm:mt-0 ${className || ''}`}
    {...props}
  />
));
AlertDialogCancel.displayName = 'AlertDialogCancel';
